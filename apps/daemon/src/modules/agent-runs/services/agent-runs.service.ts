import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { HerdrService } from '../../herdr/services/herdr.service';
import { assertRepoPath } from '../../projects/controllers/project-settings.controller';
import { BoardGateway } from '../gateways/board.gateway';
import { buildAgentArgs } from '../utils/agent-args';
import { buildSpecPrompt } from '../utils/spec-prompt';

import type { AgentRunEntity } from '../entities/agent-run.entity';

export interface PreviousSpec {
  version: number;
  content: string;
  feedback: string;
}

@Injectable()
export class AgentRunsService implements OnModuleInit {
  private readonly logger = new Logger(AgentRunsService.name);
  private readonly runsDir: string;
  private readonly callbackUrl: string;
  private readonly subscriptions = new Map<number, () => void>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly herdr: HerdrService,
    private readonly profiles: AgentProfilesService,
    private readonly board: BoardGateway,
    config: ConfigService
  ) {
    this.runsDir =
      config.get<string>('RUNS_DIR') ||
      join(homedir(), '.the-agents-org', 'runs');
    this.callbackUrl = `http://127.0.0.1:${config.get<number>('PORT')}/api/v1`;
  }

  async onModuleInit() {
    try {
      const runs = await this.prisma.agentRun.findMany({
        where: { status: 'RUNNING', paneId: { not: null } },
        include: { ticket: { select: { projectId: true } } }
      });
      for (const run of runs) {
        if (run.paneId && run.ticket.projectId !== null)
          this.watch(run.id, run.paneId, run.ticket.projectId);
      }
    } catch (error) {
      this.logger.warn(`Could not resubscribe agent runs: ${String(error)}`);
    }
  }

  async startSpec(
    ticketId: number,
    previous?: PreviousSpec
  ): Promise<AgentRunEntity> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { repo: true }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!ticket.repo) throw new BadRequestException('Ticket has no repo');
    if (!ticket.specAgent)
      throw new BadRequestException('Ticket has no spec agent');
    await assertRepoPath(ticket.repo.path);
    const profile = await this.profiles.get(ticket.specAgent);
    const running = await this.prisma.agentRun.count({
      where: { ticketId, step: 'SPEC', status: 'RUNNING' }
    });
    if (running) throw new ConflictException('Spec agent is already running');

    const run = await this.prisma.agentRun.create({
      data: {
        ticketId,
        step: 'SPEC',
        agentSlug: profile.slug,
        token: randomBytes(24).toString('hex'),
        feedback: previous?.feedback
      }
    });
    const dir = join(this.runsDir, String(run.id));
    let paneId: string | undefined;
    try {
      await mkdir(dir, { recursive: true });
      const prompt = buildSpecPrompt({
        profile,
        ticket,
        repoPath: ticket.repo.path,
        run: {
          id: run.id,
          token: run.token,
          dir,
          callbackUrl: this.callbackUrl
        },
        previous
      });
      paneId = await this.reusablePane(ticketId, profile.slug);
      if (!paneId) {
        const agent = await this.herdr.createAgent({
          agent: profile.provider,
          cwd: ticket.repo.path,
          args: buildAgentArgs(profile, this.runsDir)
        });
        paneId = agent.paneId;
        if (!agent.ready)
          throw new ConflictException(
            `Agent is waiting for input in Herdr pane ${paneId}; answer it there and retry`
          );
      }
      await this.herdr.sendPrompt(paneId, prompt);
    } catch (error) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          ...(paneId && { paneId })
        }
      });
      throw error;
    }
    const started = await this.prisma.agentRun.update({
      where: { id: run.id },
      data: { paneId }
    });
    if (ticket.projectId !== null) this.watch(run.id, paneId, ticket.projectId);
    return started;
  }

  async complete(runId: number, token: string): Promise<void> {
    const run = await this.prisma.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Agent run not found');
    const expected = Buffer.from(run.token);
    const given = Buffer.from(token ?? '');
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      throw new ForbiddenException('Invalid run token');
    if (run.status !== 'RUNNING')
      throw new ConflictException('Agent run is not running');
    let content = '';
    try {
      content = (
        await readFile(join(this.runsDir, String(run.id), 'output.md'), 'utf8')
      ).trim();
    } catch {
      // Missing file is reported below; the run stays RUNNING so the agent can retry.
    }
    if (!content)
      throw new BadRequestException('output.md is missing or empty');

    const projectId = await this.prisma.$transaction(async tx => {
      const ticket = await tx.ticket.findUnique({
        where: { id: run.ticketId }
      });
      const finishedAt = new Date();
      if (!ticket || ticket.status !== 'IN_SPEC') {
        await tx.agentRun.update({
          where: { id: run.id },
          data: { status: 'STOPPED', finishedAt }
        });
        return ticket?.projectId ?? null;
      }
      const { _max } = await tx.specVersion.aggregate({
        where: { ticketId: ticket.id },
        _max: { version: true }
      });
      await tx.specVersion.create({
        data: {
          ticketId: ticket.id,
          version: (_max.version ?? 0) + 1,
          content,
          feedback: run.feedback
        }
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: 'IN_REVIEW_SPEC', specApprovedAt: null }
      });
      await tx.agentRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', finishedAt }
      });
      return ticket.projectId;
    });
    this.subscriptions.get(run.id)?.();
    this.subscriptions.delete(run.id);
    if (projectId !== null) this.board.emitChanged(projectId);
  }

  async liveStatuses(): Promise<Map<string, string>> {
    try {
      const agents = await this.herdr.listAgents();
      return new Map(agents.map(agent => [agent.paneId, agent.status]));
    } catch {
      return new Map();
    }
  }

  // Latest spec pane of this ticket, if it still hosts the same agent.
  private async reusablePane(
    ticketId: number,
    agentSlug: string
  ): Promise<string | undefined> {
    const last = await this.prisma.agentRun.findFirst({
      where: { ticketId, step: 'SPEC', paneId: { not: null } },
      orderBy: { id: 'desc' }
    });
    if (!last?.paneId) return undefined;
    const live = await this.liveStatuses();
    if (!live.has(last.paneId)) return undefined;
    if (last.agentSlug === agentSlug) return last.paneId;
    await this.herdr.closeAgent(last.paneId);
    return undefined;
  }

  private watch(runId: number, paneId: string, projectId: number) {
    this.subscriptions.get(runId)?.();
    this.subscriptions.set(
      runId,
      this.herdr.subscribeAgent(paneId, () => this.board.emitChanged(projectId))
    );
  }
}
