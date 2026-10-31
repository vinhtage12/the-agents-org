import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { MAX_FIX_ROUNDS } from '../utils/constants';
import { type TestFailure, buildDevPrompt } from '../utils/dev-prompt';
import { parseTestCases, parseTestResults } from '../utils/test-output';
import {
  buildRunCasesPrompt,
  buildWriteCasesPrompt
} from '../utils/test-prompts';
import { AgentRunsService } from './agent-runs.service';

@Injectable()
export class TicketFlowService {
  private readonly logger = new Logger(TicketFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRuns: AgentRunsService
  ) {}

  async complete(runId: number, token: string): Promise<void> {
    const { run, output } = await this.agentRuns.claim(runId, token);
    const cases =
      run.step === 'TEST' && run.testMode === 'RUN_CASES'
        ? await this.prisma.testCase.findMany({
            where: { ticketId: run.ticketId },
            orderBy: { position: 'asc' }
          })
        : [];
    let writtenCases: ReturnType<typeof parseTestCases> = [];
    let results: (ReturnType<typeof parseTestResults>[number] & {
      testCase: (typeof cases)[number];
    })[] = [];
    try {
      if (run.step === 'TEST') {
        if (run.testMode === 'WRITE_CASES')
          writtenCases = parseTestCases(output);
        else if (run.testMode === 'RUN_CASES')
          results = parseTestResults(
            output,
            cases.map(c => c.position)
          ).map(result => {
            const testCase = cases.find(c => c.position === result.position);
            if (!testCase)
              throw new Error(`Unknown test case position ${result.position}`);
            return { ...result, testCase };
          });
        else throw new Error('Unknown test mode');
      }
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error)
      );
    }
    const outcome = await this.prisma.$transaction(async tx => {
      const ticket = await tx.ticket.findUnique({
        where: { id: run.ticketId }
      });
      const expected =
        run.step === 'SPEC'
          ? 'IN_SPEC'
          : run.step === 'DEV'
            ? 'IN_PROGRESS'
            : 'IN_TESTING';
      const valid =
        ticket &&
        (run.step === 'TEST' && run.testMode === 'WRITE_CASES'
          ? ticket.status !== 'DONE' && ticket.status !== 'CANCELED'
          : ticket.status === expected);
      await this.agentRuns.finish(tx, run.id, valid ? 'COMPLETED' : 'STOPPED');
      const failures: TestFailure[] = [];
      if (!ticket || !valid)
        return {
          projectId: ticket?.projectId ?? null,
          completed: false,
          failures
        };
      if (run.step === 'SPEC') {
        const { _max } = await tx.specVersion.aggregate({
          where: { ticketId: ticket.id },
          _max: { version: true }
        });
        await tx.specVersion.create({
          data: {
            ticketId: ticket.id,
            version: (_max.version ?? 0) + 1,
            content: output,
            feedback: run.feedback
          }
        });
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'IN_REVIEW_SPEC', specApprovedAt: null }
        });
      } else if (run.step === 'DEV') {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'IN_TESTING' }
        });
      } else if (run.testMode === 'WRITE_CASES') {
        await tx.testCase.deleteMany({ where: { ticketId: ticket.id } });
        await tx.testCase.createMany({
          data: writtenCases.map((c, index) => ({
            ...c,
            ticketId: ticket.id,
            position: index + 1
          }))
        });
      } else {
        await tx.testResult.createMany({
          data: results.map(result => ({
            agentRunId: run.id,
            testCaseId: result.testCase.id,
            passed: result.passed,
            detail: result.detail
          }))
        });
        const failed = results.filter(result => !result.passed);
        if (!failed.length) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: 'IN_REVIEW' }
          });
        } else if (ticket.fixRound < MAX_FIX_ROUNDS) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { fixRound: ticket.fixRound + 1, status: 'IN_PROGRESS' }
          });
          failures.push(
            ...failed.map(result => ({
              position: result.position,
              title: result.testCase.title,
              detail: result.detail
            }))
          );
        }
      }
      return { projectId: ticket.projectId, completed: true, failures };
    });
    this.agentRuns.afterFinish(run.id, outcome.projectId);
    if (!outcome.completed) return;
    try {
      if (outcome.failures.length)
        await this.startDev(run.ticketId, { failures: outcome.failures });
      if (run.step === 'DEV' || run.testMode === 'WRITE_CASES')
        await this.maybeRunCases(run.ticketId);
    } catch (error) {
      this.logger.warn(
        `Could not start follow-up run for ticket ${run.ticketId}: ${String(error)}`
      );
    }
  }

  async startDevelopment(
    ticketId: number,
    input: { feedback?: string }
  ): Promise<void> {
    await this.startDev(ticketId, input);
    try {
      if (await this.prisma.testCase.count({ where: { ticketId } })) return;
      if (
        await this.prisma.agentRun.count({
          where: { ticketId, step: 'TEST', status: 'RUNNING' }
        })
      )
        return;
      const spec = await this.latestSpec(ticketId);
      await this.agentRuns.start(
        ticketId,
        'TEST',
        base => buildWriteCasesPrompt({ ...base, spec }),
        { testMode: 'WRITE_CASES' }
      );
    } catch (error) {
      this.logger.warn(
        `Could not start case writing for ticket ${ticketId}: ${String(error)}`
      );
    }
  }

  private async startDev(
    ticketId: number,
    input: { feedback?: string; failures?: TestFailure[] }
  ) {
    const spec = await this.latestSpec(ticketId);
    return this.agentRuns.start(
      ticketId,
      'DEV',
      base => buildDevPrompt({ ...base, spec, ...input }),
      { feedback: input.feedback }
    );
  }

  private async latestSpec(ticketId: number): Promise<string> {
    const spec = await this.prisma.specVersion.findFirst({
      where: { ticketId },
      orderBy: { version: 'desc' }
    });
    if (!spec) throw new NotFoundException('Ticket has no spec');
    return spec.content;
  }

  async maybeRunCases(ticketId: number): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    if (!ticket || ticket.status !== 'IN_TESTING') return;
    if (
      await this.prisma.agentRun.count({
        where: { ticketId, step: 'TEST', status: 'RUNNING' }
      })
    )
      return;
    const cases = await this.prisma.testCase.findMany({
      where: { ticketId },
      orderBy: { position: 'asc' }
    });
    if (!cases.length) return;
    const dev = await this.prisma.agentRun.findFirst({
      where: { ticketId, step: 'DEV', status: 'COMPLETED' },
      orderBy: { id: 'desc' }
    });
    if (!dev) return;
    const lastTest = await this.prisma.agentRun.findFirst({
      where: { ticketId, step: 'TEST', testMode: 'RUN_CASES' },
      orderBy: { id: 'desc' }
    });
    if (lastTest && dev.id <= lastTest.id) return;
    await this.agentRuns.start(
      ticketId,
      'TEST',
      base => buildRunCasesPrompt({ ...base, cases }),
      { testMode: 'RUN_CASES' }
    );
  }
}
