import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '#database/prisma.service';
import { AgentProfilesService } from '#modules/agent-profiles/services/agent-profiles.service';
import { buildAgentArgs } from '#modules/agent-runs/utils/agent-args';
import { HerdrService } from '#modules/herdr/services/herdr.service';
import { assertRepoPath } from '#modules/repositories/utils/repo-path';

import { MAX_RUN_MS, RUNS_PAGE_SIZE } from '../constants';
import { ScheduledRunStatus } from '../enum';
import { expandHome, outputFileName } from '../utils/output-file';
import { buildScheduledPrompt } from '../utils/scheduled-prompt';

import type {
  ScheduledRun,
  ScheduledRunTrigger
} from '#/generated/prisma/client';
import type { RunAgent } from '#modules/agent-runs/utils/spec-prompt';

export type ScheduledRunView = Omit<ScheduledRun, 'token' | 'output'>;
export type AttentionItem = {
  id: number;
  taskId: number;
  taskName: string;
  status: 'MISSED' | 'FAILED';
  scheduledFor: Date;
  error: string | null;
};

@Injectable()
export class ScheduledRunnerService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledRunnerService.name);
  private readonly runsDir: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly herdr: HerdrService,
    private readonly profiles: AgentProfilesService,
    config: ConfigService
  ) {
    this.runsDir =
      config.get<string>('RUNS_DIR') ||
      join(homedir(), '.the-agents-org', 'runs');
    this.callbackUrl = `http://127.0.0.1:${config.get<number>('PORT')}/api/v1`;
  }

  async start(
    taskId: number,
    trigger: ScheduledRunTrigger,
    scheduledFor: Date,
    rerunOfId?: number
  ): Promise<ScheduledRunView> {
    const task = await this.prisma.scheduledTask.findUnique({
      where: { id: taskId },
      include: {
        repos: { orderBy: { position: 'asc' }, include: { repo: true } },
        agent: true
      }
    });
    if (!task) throw new NotFoundException('Scheduled task not found');
    const startedAt = new Date();
    const token = randomBytes(24).toString('hex');
    let run: ScheduledRun;
    let outputPath: string | undefined;
    let paneId: string | undefined;
    let stoppedWhileStarting = false;
    try {
      run = await this.prisma.scheduledRun.create({
        data: {
          taskId,
          scheduledFor,
          trigger,
          status: 'RUNNING',
          startedAt,
          token,
          rerunOfId,
          agentName: task.agent.name,
          agentId: task.agentId
        }
      });
    } catch (error) {
      if (isP2002(error) && errorText(error).includes('one_running_per_task'))
        throw new ConflictException('Task is already running');
      throw error;
    }
    try {
      const profile = (await this.profiles.get(task.agentId)) as RunAgent;
      await stat(join(profile.path, 'AGENT.md'));
      const repos = task.repos.map(link => link.repo);
      await Promise.all(repos.map(repo => assertRepoPath(repo.path)));
      const outputDir = expandHome(task.outputDir);
      await mkdir(outputDir, { recursive: true });
      outputPath = join(outputDir, outputFileName(task.slug, scheduledFor));
      await this.prisma.scheduledRun.update({
        where: { id: run.id },
        data: { outputPath }
      });
      const prompt = buildScheduledPrompt({
        profile,
        prompt: task.prompt,
        scheduledFor,
        repoPaths: repos.map(repo => repo.path),
        outputFile: outputPath,
        run: { id: run.id, token, callbackUrl: this.callbackUrl }
      });
      const agent = await this.herdr.createAgent({
        agent: profile.provider,
        cwd: repos[0].path,
        args: buildAgentArgs(
          profile,
          this.runsDir,
          ...repos.slice(1).map(repo => repo.path),
          outputDir
        )
      });
      paneId = agent.paneId;
      if (!agent.ready)
        throw new ConflictException(
          `Agent is waiting for input in Herdr pane ${agent.paneId}; answer it there and retry`
        );
      await this.herdr.sendPrompt(agent.paneId, prompt);
      const { count } = await this.prisma.scheduledRun.updateMany({
        where: { id: run.id, status: ScheduledRunStatus.RUNNING },
        data: { paneId }
      });
      if (count === 0) {
        stoppedWhileStarting = true;
        await this.herdr
          .closeAgent(paneId)
          .catch(error =>
            this.logger.warn(
              `Could not close scheduled run pane ${paneId}: ${String(error)}`
            )
          );
        throw new ConflictException('Run was stopped while starting');
      }
      run = { ...run, paneId, outputPath };
      return this.view(run);
    } catch (error) {
      if (stoppedWhileStarting) {
        if (trigger !== 'SCHEDULE') throw error;
        const current = await this.prisma.scheduledRun.findUnique({
          where: { id: run.id }
        });
        return this.view(current ?? run);
      }
      await this.prisma.scheduledRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: message(error),
          finishedAt: new Date(),
          ...(paneId && { paneId })
        }
      });
      if (trigger !== 'SCHEDULE') throw error;
      this.logger.error(
        `Scheduled task ${taskId} failed to start: ${message(error)}`
      );
      return this.view({
        ...run,
        status: 'FAILED',
        error: message(error),
        finishedAt: new Date()
      });
    }
  }

  async recordMissed(taskId: number, scheduledFor: Date) {
    await this.insertTerminal(taskId, scheduledFor, 'MISSED');
  }
  async recordSkipped(taskId: number, scheduledFor: Date) {
    await this.insertTerminal(
      taskId,
      scheduledFor,
      'SKIPPED',
      'previous run still running'
    );
  }
  async hasRunning(taskId: number) {
    return (
      (await this.prisma.scheduledRun.count({
        where: { taskId, status: 'RUNNING' }
      })) > 0
    );
  }

  async complete(runId: number, token: string): Promise<void> {
    const run = await this.findRun(runId);
    const expected = Buffer.from(run.token);
    const given = Buffer.from(token ?? '');
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      throw new ForbiddenException('Invalid run token');
    if (run.status !== 'RUNNING')
      throw new ConflictException('Scheduled run is not running');
    let output: string;
    try {
      const info = await stat(run.outputPath ?? '');
      if (!run.startedAt || info.mtime < run.startedAt)
        throw new Error('output file missing');
      output = await readFile(run.outputPath ?? '', 'utf8');
    } catch {
      await this.prisma.scheduledRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          error: 'output file missing',
          finishedAt: new Date()
        }
      });
      throw new ConflictException('output file missing');
    }
    await this.prisma.scheduledRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', output, finishedAt: new Date() }
    });
    if (run.paneId) {
      await this.herdr
        .closeAgent(run.paneId)
        .catch(error =>
          this.logger.warn(
            `Could not close scheduled run pane ${run.paneId}: ${String(error)}`
          )
        );
    }
  }

  async stop(runId: number): Promise<ScheduledRunView> {
    const run = await this.findRun(runId);
    if (run.status !== 'RUNNING')
      throw new ConflictException('Scheduled run is not running');
    const stopped = await this.prisma.scheduledRun.update({
      where: { id: runId },
      data: { status: 'STOPPED', finishedAt: new Date() }
    });
    if (run.paneId) await this.herdr.closeAgent(run.paneId);
    return this.view(stopped);
  }

  async rerun(runId: number): Promise<ScheduledRunView> {
    const original = await this.findRun(runId);
    if (!['MISSED', 'FAILED'].includes(original.status))
      throw new ConflictException('Only missed or failed runs can be rerun');
    if (original.rerun)
      throw new ConflictException('Run has already been rerun');
    return this.start(
      original.taskId,
      'RERUN',
      original.scheduledFor,
      original.id
    );
  }

  async dismiss(runId: number): Promise<void> {
    const run = await this.findRun(runId);
    if (run.status !== 'MISSED' && run.status !== 'FAILED')
      throw new ConflictException(
        'Only missed or failed runs can be dismissed'
      );
    await this.prisma.scheduledRun.update({
      where: { id: runId },
      data: { dismissedAt: new Date() }
    });
  }

  async attention(): Promise<AttentionItem[]> {
    const rows = await this.prisma.scheduledRun.findMany({
      where: {
        status: { in: ['MISSED', 'FAILED'] },
        dismissedAt: null,
        rerun: { is: null }
      },
      include: { task: { select: { name: true } } },
      orderBy: { scheduledFor: 'desc' }
    });
    return rows.map(({ task, ...run }) => ({
      id: run.id,
      taskId: run.taskId,
      taskName: task.name,
      status: run.status as 'MISSED' | 'FAILED',
      scheduledFor: run.scheduledFor,
      error: run.error
    }));
  }

  async runs(
    taskId: number,
    page: number
  ): Promise<{ data: ScheduledRunView[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.scheduledRun.findMany({
        where: { taskId },
        orderBy: { scheduledFor: 'desc' },
        skip: (page - 1) * RUNS_PAGE_SIZE,
        take: RUNS_PAGE_SIZE
      }),
      this.prisma.scheduledRun.count({ where: { taskId } })
    ]);
    return { data: rows.map((run: ScheduledRun) => this.view(run)), total };
  }

  async output(runId: number): Promise<{ content: string }> {
    const run = await this.findRun(runId);
    if (run.output === null)
      throw new NotFoundException('Run output not found');
    return { content: run.output };
  }

  async failTimedOut(now: Date): Promise<void> {
    await this.prisma.scheduledRun.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: new Date(now.getTime() - MAX_RUN_MS) }
      },
      data: { status: 'FAILED', error: 'timed out', finishedAt: now }
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const runs = await this.prisma.scheduledRun.findMany({
        where: { status: 'RUNNING' }
      });
      const live = new Set(
        (await this.herdr.listAgents()).map(agent => agent.paneId)
      );
      for (const run of runs)
        if (!run.paneId || !live.has(run.paneId))
          await this.prisma.scheduledRun.update({
            where: { id: run.id },
            data: {
              status: 'FAILED',
              error: 'Agent pane is gone',
              finishedAt: new Date()
            }
          });
    } catch (error) {
      this.logger.warn(`Could not reconcile scheduled runs: ${String(error)}`);
    }
  }

  private async insertTerminal(
    taskId: number,
    scheduledFor: Date,
    status: 'MISSED' | 'SKIPPED',
    error?: string
  ) {
    try {
      await this.prisma.scheduledRun.create({
        data: {
          taskId,
          scheduledFor,
          trigger: 'SCHEDULE',
          status,
          agentName: '',
          token: '',
          ...(error && { error })
        }
      });
    } catch (e) {
      if (!isP2002(e)) throw e;
    }
  }
  private async findRun(
    id: number
  ): Promise<ScheduledRun & { rerun?: ScheduledRun | null }> {
    const run = await this.prisma.scheduledRun.findUnique({
      where: { id },
      include: { rerun: true }
    });
    if (!run) throw new NotFoundException('Scheduled run not found');
    return run;
  }
  private view(run: ScheduledRun): ScheduledRunView {
    const { token: _token, output: _output, ...view } = run;
    return view;
  }
}

function isP2002(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
function errorText(error: unknown): string {
  return JSON.stringify((error as { meta?: unknown }).meta ?? error);
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
