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
  | 'specApprovedAt'
> & {
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
    private readonly profiles: AgentProfilesService
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
            orderBy: { id: 'desc' },
            take: 1
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
        run: runs[0] ?? null,
        paneStatus: runs[0]?.paneId ? live.get(runs[0].paneId) : undefined,
        now
      }),
      specVersion: specs[0]?.version ?? null
    }));
  }

  async detail(id: number): Promise<TicketDetail> {
    const ticket = await this.find(id);
    const [repos, projects, spec, runs, live] = await Promise.all([
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
        orderBy: { id: 'desc' },
        take: 20
      }),
      this.agentRuns.liveStatuses()
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
      specApprovedAt: ticket.specApprovedAt,
      label: boardLabel({
        status: ticket.status,
        specApprovedAt: ticket.specApprovedAt,
        run,
        paneStatus: run?.paneId ? live.get(run.paneId) : undefined,
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
    // Only TODO → IN_SPEC exists in this plan; the conditional update rejects double drops.
    await this.enterSpec(ticket, 'TODO', {}, () =>
      this.agentRuns.startSpec(id)
    );
    return this.detail(id);
  }

  async feedback(id: number, feedback: string): Promise<TicketDetail> {
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

  async stopSpec(id: number): Promise<TicketDetail> {
    const ticket = await this.find(id);
    if (ticket.status !== 'IN_SPEC')
      throw new ConflictException('Ticket is not in spec');
    await this.agentRuns.stopSpec(id);
    // Back to where the spec step started: review if a spec exists, otherwise To Do.
    const back = (await this.latestSpec(id)) ? 'IN_REVIEW_SPEC' : 'TODO';
    await this.prisma.ticket.updateMany({
      where: { id, status: 'IN_SPEC' },
      data: { status: back }
    });
    this.emit(ticket.projectId);
    return this.detail(id);
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
    if (input.specAgent !== undefined && input.specAgent !== ticket.specAgent) {
      if (await this.runningCount(id, 'SPEC'))
        throw new ConflictException('Spec agent is locked while it runs');
      data.specAgent = input.specAgent;
    }
    for (const key of ['devAgent', 'testAgent'] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    await this.profiles.assertExists([
      input.specAgent,
      input.devAgent,
      input.testAgent
    ]);
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

  private runningCount(ticketId: number, step?: 'SPEC') {
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
    const claimed = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: from },
      data: { status: 'IN_SPEC', ...extra }
    });
    if (claimed.count !== 1)
      throw new ConflictException('Ticket was moved by another request');
    try {
      await start();
    } catch (error) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
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
