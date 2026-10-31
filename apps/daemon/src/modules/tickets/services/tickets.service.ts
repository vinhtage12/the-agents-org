import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { BoardGateway } from '../../agent-runs/gateways/board.gateway';
import { AgentRunsService } from '../../agent-runs/services/agent-runs.service';
import { TicketFlowService } from '../../agent-runs/services/ticket-flow.service';
import { type BoardLabel, boardLabel } from '../utils/board-label';
import { assertTransition } from '../utils/transitions';

import type { AgentRunEntity } from '../../agent-runs/entities/agent-run.entity';
import type { ProjectRepoEntity } from '../../projects/entities/project-repo.entity';
import type { ProjectEntity } from '../../workspaces/entities/project.entity';
import type { SpecVersionEntity } from '../entities/spec-version.entity';
import type { TicketEntity, TicketStatus } from '../entities/ticket.entity';

type TicketStoreItem = Pick<
  TicketEntity,
  'id' | 'jiraKey' | 'summary' | 'issueType' | 'jiraUrl'
>;
type TicketBoardItem = Pick<
  TicketEntity,
  'id' | 'jiraKey' | 'summary' | 'status' | 'jiraUrl'
> & { label: BoardLabel; specVersion: number | null };
export type TicketDetail = Pick<
  TicketEntity,
  | 'id'
  | 'jiraKey'
  | 'summary'
  | 'description'
  | 'jiraUrl'
  | 'status'
  | 'projectId'
  | 'repoId'
  | 'specAgent'
  | 'devAgent'
  | 'testAgent'
  | 'extraInstructions'
  | 'extraSkills'
  | 'fixRound'
  | 'specApprovedAt'
> & {
  testCases: {
    id: number;
    position: number;
    title: string;
    steps: string;
    expected: string;
  }[];
  testResults: {
    agentRunId: number;
    finishedAt: Date | null;
    results: { position: number; passed: boolean; detail: string }[];
  } | null;
  label: BoardLabel;
  spec: Pick<
    SpecVersionEntity,
    'version' | 'content' | 'editedAt' | 'feedback'
  > | null;
  repos: Pick<ProjectRepoEntity, 'id' | 'name' | 'path'>[];
  projects: Pick<ProjectEntity, 'id' | 'name' | 'code'>[];
  runs: Omit<AgentRunEntity, 'token' | 'ticketId' | 'feedback'>[];
};
export interface UpdateTicketInput {
  projectId?: number;
  repoId?: number | null;
  specAgent?: string | null;
  devAgent?: string | null;
  testAgent?: string | null;
  extraInstructions?: string;
  extraSkills?: string[];
}
const RUN_SELECT = {
  id: true,
  step: true,
  testMode: true,
  agentSlug: true,
  status: true,
  paneId: true,
  error: true,
  startedAt: true,
  finishedAt: true
} as const;

export function suggestProjectId(
  jiraKey: string,
  projects: { id: number; code: string }[]
): number | null {
  const dash = jiraKey.lastIndexOf('-');
  if (dash < 0) return null;
  const prefix = jiraKey.slice(0, dash).toUpperCase();
  return projects.find(p => p.code.toUpperCase() === prefix)?.id ?? null;
}
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRuns: AgentRunsService,
    private readonly boardEvents: BoardGateway,
    private readonly profiles: AgentProfilesService,
    private readonly flow: TicketFlowService
  ) {}
  async store(): Promise<{
    tickets: (TicketStoreItem & { suggestedProjectId: number | null })[];
    projects: Pick<ProjectEntity, 'id' | 'name' | 'code' | 'workspaceId'>[];
  }> {
    const [tickets, projects] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { projectId: null, status: { not: 'CANCELED' } },
        select: {
          id: true,
          jiraKey: true,
          summary: true,
          issueType: true,
          jiraUrl: true
        },
        orderBy: { id: 'asc' }
      }),
      this.prisma.project.findMany({
        select: { id: true, name: true, code: true, workspaceId: true },
        orderBy: { id: 'asc' }
      })
    ]);
    return {
      tickets: tickets.map(ticket => ({
        ...ticket,
        suggestedProjectId: suggestProjectId(ticket.jiraKey, projects)
      })),
      projects
    };
  }
  link(links: { ticketId: number; projectId: number }[]) {
    return this.prisma.$transaction(async tx => {
      for (const { ticketId, projectId } of links) {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException('Ticket not found');
        if (ticket.projectId !== null)
          throw new ConflictException(
            `Ticket ${ticket.jiraKey} is already linked`
          );
        if (ticket.status === 'CANCELED')
          throw new ConflictException(`Ticket ${ticket.jiraKey} is canceled`);
        const project = await tx.project.findUnique({
          where: { id: projectId }
        });
        if (!project) throw new NotFoundException('Project not found');
        const updated = await tx.ticket.updateMany({
          where: { id: ticketId, projectId: null, status: { not: 'CANCELED' } },
          data: {
            projectId,
            status: 'TODO',
            linkedAt: new Date(),
            repoId: project.defaultRepoId,
            specAgent: project.specAgent,
            devAgent: project.devAgent,
            testAgent: project.testAgent
          }
        });
        if (updated.count !== 1)
          throw new ConflictException(
            `Ticket ${ticket.jiraKey} is already linked or canceled`
          );
      }
      return { linked: links.length };
    });
  }
  async board(projectId: number): Promise<TicketBoardItem[]> {
    if (!(await this.prisma.project.findUnique({ where: { id: projectId } })))
      throw new NotFoundException('Project not found');
    const [tickets, live] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { projectId },
        select: {
          id: true,
          jiraKey: true,
          summary: true,
          status: true,
          jiraUrl: true,
          specApprovedAt: true,
          runs: {
            select: { status: true, paneId: true, startedAt: true },
            orderBy: { id: 'desc' }
          },
          specs: {
            select: { version: true },
            orderBy: { version: 'desc' },
            take: 1
          }
        },
        orderBy: { linkedAt: 'asc' }
      }),
      this.agentRuns.liveStatuses()
    ]);
    const now = new Date();
    return tickets.map(({ runs, specs, specApprovedAt, ...ticket }) => ({
      ...ticket,
      label: boardLabel({
        status: ticket.status,
        specApprovedAt,
        running: runs.filter(run => run.status === 'RUNNING'),
        lastRun: runs[0] ?? null,
        paneStatuses: live,
        now
      }),
      specVersion: specs[0]?.version ?? null
    }));
  }

  async detail(id: number): Promise<TicketDetail> {
    const ticket = await this.find(id);
    const [repos, projects, spec, runs, live, testCases, testRun] =
      await Promise.all([
        ticket.projectId === null
          ? []
          : this.prisma.projectRepo.findMany({
              where: { projectId: ticket.projectId },
              select: { id: true, name: true, path: true },
              orderBy: { name: 'asc' }
            }),
        ticket.status === 'TODO' && ticket.project
          ? this.prisma.project.findMany({
              where: { workspaceId: ticket.project.workspaceId },
              select: { id: true, name: true, code: true },
              orderBy: { name: 'asc' }
            })
          : [],
        this.latestSpec(id),
        this.prisma.agentRun.findMany({
          where: { ticketId: id },
          select: RUN_SELECT,
          orderBy: { id: 'desc' }
        }),
        this.agentRuns.liveStatuses(),
        this.prisma.testCase.findMany({
          where: { ticketId: id },
          select: {
            id: true,
            position: true,
            title: true,
            steps: true,
            expected: true
          },
          orderBy: { position: 'asc' }
        }),
        this.prisma.agentRun.findFirst({
          where: {
            ticketId: id,
            step: 'TEST',
            testMode: 'RUN_CASES',
            status: 'COMPLETED'
          },
          orderBy: { id: 'desc' },
          select: {
            id: true,
            finishedAt: true,
            results: {
              select: {
                passed: true,
                detail: true,
                testCase: { select: { position: true } }
              },
              orderBy: { testCase: { position: 'asc' } }
            }
          }
        })
      ]);
    const run = runs[0] ?? null;
    return {
      id: ticket.id,
      jiraKey: ticket.jiraKey,
      summary: ticket.summary,
      description: ticket.description,
      jiraUrl: ticket.jiraUrl,
      status: ticket.status,
      projectId: ticket.projectId,
      repoId: ticket.repoId,
      specAgent: ticket.specAgent,
      devAgent: ticket.devAgent,
      testAgent: ticket.testAgent,
      extraInstructions: ticket.extraInstructions,
      extraSkills: ticket.extraSkills,
      fixRound: ticket.fixRound,
      testCases,
      testResults: testRun
        ? {
            agentRunId: testRun.id,
            finishedAt: testRun.finishedAt,
            results: testRun.results.map(result => ({
              position: result.testCase.position,
              passed: result.passed,
              detail: result.detail
            }))
          }
        : null,
      specApprovedAt: ticket.specApprovedAt,
      label: boardLabel({
        status: ticket.status,
        specApprovedAt: ticket.specApprovedAt,
        running: runs.filter(item => item.status === 'RUNNING'),
        lastRun: run,
        paneStatuses: live,
        now: new Date()
      }),
      spec: spec && {
        version: spec.version,
        content: spec.content,
        editedAt: spec.editedAt,
        feedback: spec.feedback
      },
      repos,
      projects,
      runs
    };
  }

  async move(id: number, to: TicketStatus): Promise<TicketDetail> {
    const ticket = await this.find(id);
    assertTransition(ticket.status, to);
    if (to === 'IN_SPEC') {
      await this.enterSpec(ticket, 'TODO', {}, () =>
        this.agentRuns.startSpec(id)
      );
    } else {
      if (to === 'IN_PROGRESS' && !ticket.specApprovedAt)
        throw new ConflictException('Spec is not approved');
      if (to === 'IN_REVIEW' && (await this.runningCount(id)))
        throw new ConflictException('An agent is still running');
      await this.enterStatus(
        ticket,
        ticket.status,
        to,
        to === 'IN_PROGRESS' ? { fixRound: 0 } : {},
        async () => {
          if (to === 'IN_PROGRESS') await this.flow.startDevelopment(id, {});
          if (to === 'DONE') await this.agentRuns.closeTicketPanes(id);
        }
      );
    }
    return this.detail(id);
  }

  async specFeedback(id: number, feedback: string): Promise<TicketDetail> {
    const ticket = await this.find(id);
    const spec = await this.reviewableSpec(ticket);
    await this.enterSpec(
      ticket,
      'IN_REVIEW_SPEC',
      { specApprovedAt: null },
      () =>
        this.agentRuns.startSpec(id, {
          version: spec.version,
          content: spec.content,
          feedback
        })
    );
    return this.detail(id);
  }

  async feedback(id: number, feedback: string): Promise<TicketDetail> {
    const ticket = await this.find(id);
    if (
      !['IN_REVIEW', 'IN_TESTING', 'IN_PROGRESS'].includes(ticket.status) ||
      (ticket.status !== 'IN_REVIEW' && (await this.runningCount(id)))
    )
      throw new ConflictException('Ticket cannot receive development feedback');
    await this.enterStatus(
      ticket,
      ticket.status,
      'IN_PROGRESS',
      { fixRound: 0 },
      () => this.flow.startDevelopment(id, { feedback })
    );
    return this.detail(id);
  }

  async stop(id: number): Promise<TicketDetail> {
    const ticket = await this.find(id);
    const count =
      ticket.status === 'IN_SPEC'
        ? await this.agentRuns.stop(id, 'SPEC')
        : await this.agentRuns.stop(id);
    if (!count && ticket.status !== 'IN_SPEC')
      throw new ConflictException('No running agents to stop');
    if (ticket.status === 'IN_SPEC') {
      const back = (await this.latestSpec(id)) ? 'IN_REVIEW_SPEC' : 'TODO';
      await this.prisma.ticket.updateMany({
        where: { id, status: 'IN_SPEC' },
        data: { status: back }
      });
    }
    this.emit(ticket.projectId);
    return this.detail(id);
  }

  async repoConflicts(id: number): Promise<{
    tickets: { id: number; jiraKey: string; projectId: number | null }[];
  }> {
    const ticket = await this.find(id);
    if (ticket.repoId === null) return { tickets: [] };
    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: { not: id },
        repoId: ticket.repoId,
        runs: { some: { status: 'RUNNING' } }
      },
      select: { id: true, jiraKey: true, projectId: true }
    });
    return { tickets };
  }

  async saveSpec(id: number, content: string): Promise<TicketDetail> {
    const ticket = await this.find(id);
    const spec = await this.reviewableSpec(ticket);
    // Editing after approval needs a fresh approval.
    await this.prisma.$transaction([
      this.prisma.specVersion.update({
        where: { id: spec.id },
        data: { content, editedAt: new Date() }
      }),
      this.prisma.ticket.update({
        where: { id },
        data: { specApprovedAt: null }
      })
    ]);
    this.emit(ticket.projectId);
    return this.detail(id);
  }

  async approve(id: number): Promise<TicketDetail> {
    const ticket = await this.find(id);
    await this.reviewableSpec(ticket);
    await this.prisma.ticket.update({
      where: { id },
      data: { specApprovedAt: new Date() }
    });
    this.emit(ticket.projectId);
    return this.detail(id);
  }

  async update(id: number, input: UpdateTicketInput): Promise<TicketDetail> {
    const ticket = await this.find(id);
    const data: UpdateTicketInput = {};
    let projectId = ticket.projectId;
    if (input.projectId !== undefined && input.projectId !== ticket.projectId) {
      if (ticket.status !== 'TODO')
        throw new ConflictException('Project can only change while in To Do');
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId }
      });
      if (!project) throw new NotFoundException('Project not found');
      projectId = project.id;
      Object.assign(data, {
        projectId: project.id,
        repoId: project.defaultRepoId,
        specAgent: project.specAgent,
        devAgent: project.devAgent,
        testAgent: project.testAgent
      });
    }
    if (input.repoId !== undefined && input.repoId !== ticket.repoId) {
      if (
        input.repoId !== null &&
        !(await this.prisma.projectRepo.findFirst({
          where: { id: input.repoId, projectId: projectId ?? undefined }
        }))
      )
        throw new BadRequestException('Repo does not belong to the project');
      if (await this.runningCount(id))
        throw new ConflictException('Repo is locked while an agent runs');
      data.repoId = input.repoId;
    }
    const steps = {
      specAgent: 'SPEC',
      devAgent: 'DEV',
      testAgent: 'TEST'
    } as const;
    for (const key of ['specAgent', 'devAgent', 'testAgent'] as const) {
      if (input[key] !== undefined) data[key] = input[key];
      if (
        data[key] !== undefined &&
        data[key] !== ticket[key] &&
        (await this.runningCount(id, steps[key]))
      )
        throw new ConflictException(
          `${steps[key]} agent is locked while it runs`
        );
    }
    await this.profiles.assertExists(
      (['specAgent', 'devAgent', 'testAgent'] as const)
        .filter(key => data[key] !== undefined && data[key] !== ticket[key])
        .map(key => data[key])
    );
    if (input.extraInstructions !== undefined)
      data.extraInstructions = input.extraInstructions;
    if (input.extraSkills !== undefined) data.extraSkills = input.extraSkills;
    await this.prisma.ticket.update({ where: { id }, data });
    this.emit(ticket.projectId);
    if (projectId !== ticket.projectId) this.emit(projectId);
    return this.detail(id);
  }

  private async find(id: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { project: { select: { id: true, workspaceId: true } } }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private latestSpec(ticketId: number) {
    return this.prisma.specVersion.findFirst({
      where: { ticketId },
      orderBy: { version: 'desc' }
    });
  }

  private async reviewableSpec(ticket: { id: number; status: TicketStatus }) {
    if (ticket.status !== 'IN_REVIEW_SPEC')
      throw new ConflictException('Ticket is not in spec review');
    const spec = await this.latestSpec(ticket.id);
    if (!spec) throw new ConflictException('Ticket has no spec');
    return spec;
  }

  private runningCount(ticketId: number, step?: 'SPEC' | 'DEV' | 'TEST') {
    return this.prisma.agentRun.count({
      where: { ticketId, status: 'RUNNING', ...(step && { step }) }
    });
  }

  // Claims the move with a conditional update, starts the agent, and rolls back on failure.
  private async enterSpec(
    ticket: { id: number; projectId: number | null },
    from: TicketStatus,
    extra: { specApprovedAt?: null },
    start: () => Promise<unknown>
  ) {
    await this.enterStatus(ticket, from, 'IN_SPEC', extra, start);
  }

  private async enterStatus(
    ticket: { id: number; projectId: number | null },
    from: TicketStatus,
    to: TicketStatus,
    extra: { specApprovedAt?: null; fixRound?: number },
    start: () => Promise<unknown>
  ) {
    const claimed = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: from },
      data: { status: to, ...extra }
    });
    if (claimed.count !== 1)
      throw new ConflictException('Ticket was moved by another request');
    try {
      await start();
    } catch (error) {
      await this.prisma.ticket.updateMany({
        where: { id: ticket.id, status: to },
        data: { status: from }
      });
      throw error;
    } finally {
      this.emit(ticket.projectId);
    }
  }

  private emit(projectId: number | null) {
    if (projectId !== null) this.boardEvents.emitChanged(projectId);
  }
}
