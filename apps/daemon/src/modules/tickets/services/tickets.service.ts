import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';
import { AgentProfilesService } from '#modules/agent-profiles/services/agent-profiles.service';
import { BoardGateway } from '#modules/agent-runs/gateways/board.gateway';
import { AgentRunsService } from '#modules/agent-runs/services/agent-runs.service';
import { TicketFlowService } from '#modules/agent-runs/services/ticket-flow.service';
import { GitService } from '#modules/git/services/git.service';

import { type BoardLabel, boardLabel } from '../utils/board-label';
import { resolveSpecFile } from '../utils/spec-file';
import { assertSprintAssignable } from '../utils/sprint-assign';
import { assertTransition } from '../utils/transitions';

import type {
  Prisma,
  SpecSource,
  SprintSource
} from '#/generated/prisma/client';
import type { AgentRunEntity } from '#modules/agent-runs/entities/agent-run.entity';
import type { RepoEntity } from '#modules/repositories/entities/repo.entity';
import type { ProjectEntity } from '#modules/workspaces/entities/project.entity';
import type { SpecVersionEntity } from '../entities/spec-version.entity';
import type { TicketEntity, TicketStatus } from '../entities/ticket.entity';

type TicketStoreItem = Pick<
  TicketEntity,
  'id' | 'jiraKey' | 'summary' | 'issueType' | 'jiraUrl'
>;
type TicketBoardItem = Pick<
  TicketEntity,
  | 'id'
  | 'jiraKey'
  | 'summary'
  | 'status'
  | 'jiraUrl'
  | 'branch'
  | 'repoId'
  | 'source'
  | 'sprintId'
> & {
  label: BoardLabel;
  specVersion: number | null;
  agent: { id: number; name: string } | null;
};
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
  | 'branch'
  | 'extraInstructions'
  | 'fixRound'
  | 'specApprovedAt'
  | 'source'
  | 'issueType'
  | 'specFile'
  | 'sprintId'
> & {
  parent: {
    key: string;
    summary: string | null;
    description: string | null;
    jiraUrl: string;
  } | null;
  sprintSource: SprintSource | null;
  projectSpecSource: SpecSource | null;
  specAgent: AgentRef | null;
  devAgent: AgentRef | null;
  testAgent: AgentRef | null;
  skills: { id: number; name: string; provider: string; command: string }[];
  rules: { id: number; name: string }[];
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
  repos: Pick<RepoEntity, 'id' | 'name' | 'path'>[];
  projects: Pick<ProjectEntity, 'id' | 'name' | 'code'>[];
  runs: Omit<AgentRunEntity, 'token' | 'ticketId' | 'feedback'>[];
};
export type AgentRef = {
  id: number;
  name: string;
  role: string;
  provider: string;
  model: string | null;
};
export type CreateLocalTicketInput = {
  summary: string;
  issueType: string;
  specFile?: string;
  description?: string;
  sprintId?: number | null;
};
export type UpdateLocalTicketInput = Partial<
  Omit<CreateLocalTicketInput, 'sprintId' | 'specFile'>
> & { specFile?: string | null };

export interface UpdateTicketInput {
  projectId?: number;
  repoId?: number | null;
  specAgentId?: number | null;
  devAgentId?: number | null;
  testAgentId?: number | null;
  skillIds?: number[];
  ruleIds?: number[];
  sprintId?: number | null;
  extraInstructions?: string;
}
const AGENT_REF = {
  select: { id: true, name: true, role: true, provider: true, model: true }
} as const;
const RUN_SELECT = {
  id: true,
  step: true,
  testMode: true,
  agentSlug: true,
  agentId: true,
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
    private readonly flow: TicketFlowService,
    private readonly git: GitService
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
  async createLocal(
    projectId: number,
    input: CreateLocalTicketInput
  ): Promise<TicketDetail> {
    const ticket = await this.prisma.$transaction(async tx => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.specSource === 'JIRA')
        throw new ConflictException('Project does not accept local tickets');
      const specFile = input.specFile?.trim() || null;
      const description = input.description?.trim() ?? '';
      if (Boolean(specFile) === Boolean(description))
        throw new BadRequestException('Provide either a spec file or a spec');
      if (specFile) await resolveSpecFile(project.specDir ?? '', specFile);
      if (input.sprintId != null)
        await this.assertSprint(
          { source: 'LOCAL', sprintSource: null },
          projectId,
          input.sprintId,
          project.specSource
        );
      // A project that reused this code earlier may already own the next key.
      let jiraKey = '';
      for (let attempt = 0; attempt < 100 && !jiraKey; attempt++) {
        const numbered = await tx.project.update({
          where: { id: projectId },
          data: { localTicketSeq: { increment: 1 } }
        });
        const key = `${numbered.code}-L${numbered.localTicketSeq}`;
        if (!(await tx.ticket.findUnique({ where: { jiraKey: key } })))
          jiraKey = key;
      }
      if (!jiraKey) throw new ConflictException('No free local ticket number');
      return tx.ticket.create({
        data: {
          jiraKey,
          summary: input.summary.trim(),
          issueType: input.issueType,
          specFile,
          description,
          source: 'LOCAL',
          status: 'TODO',
          jiraUrl: '',
          jiraStatus: '',
          projectId,
          sprintId: input.sprintId ?? null,
          linkedAt: new Date(),
          repoId: project.defaultRepoId,
          specAgentId: project.specAgentId,
          devAgentId: project.devAgentId,
          testAgentId: project.testAgentId
        }
      });
    });
    this.emit(projectId);
    return this.detail(ticket.id);
  }

  async updateLocal(
    id: number,
    input: UpdateLocalTicketInput
  ): Promise<TicketDetail> {
    const ticket = await this.find(id);
    if (ticket.source !== 'LOCAL' || ticket.status !== 'TODO')
      throw new ConflictException('Only local tickets in TODO can be edited');
    if (input.specFile?.trim() && input.description?.trim())
      throw new BadRequestException('Provide either a spec file or a spec');
    let specFile = ticket.specFile;
    let description = ticket.description;
    if (input.specFile !== undefined) {
      specFile = input.specFile?.trim() || null;
      if (specFile) {
        await resolveSpecFile(ticket.project?.specDir ?? '', specFile);
        description = '';
      }
    }
    if (input.description !== undefined) {
      description = input.description.trim();
      specFile = null;
    }
    if (Boolean(specFile) === Boolean(description.trim()))
      throw new BadRequestException('Provide either a spec file or a spec');
    const updated = await this.prisma.ticket.updateMany({
      where: { id, source: 'LOCAL', status: 'TODO' },
      data: {
        ...(input.summary !== undefined && { summary: input.summary.trim() }),
        ...(input.issueType !== undefined && { issueType: input.issueType }),
        specFile,
        description
      }
    });
    if (updated.count !== 1)
      throw new ConflictException('Ticket changed while editing');
    this.emit(ticket.projectId);
    return this.detail(id);
  }

  async link(links: { ticketId: number; projectId: number }[]) {
    const result = await this.prisma.$transaction(async tx => {
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
        if (project.specSource === 'LOCAL')
          throw new ConflictException(
            `Project ${project.code} only accepts local tickets`
          );
        const updated = await tx.ticket.updateMany({
          where: { id: ticketId, projectId: null, status: { not: 'CANCELED' } },
          data: {
            projectId,
            status: 'TODO',
            linkedAt: new Date(),
            repoId: project.defaultRepoId,
            specAgentId: project.specAgentId,
            devAgentId: project.devAgentId,
            testAgentId: project.testAgentId
          }
        });
        if (updated.count !== 1)
          throw new ConflictException(
            `Ticket ${ticket.jiraKey} is already linked or canceled`
          );
      }
      return { linked: links.length };
    });
    for (const projectId of new Set(links.map(link => link.projectId)))
      this.emit(projectId);
    return result;
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
          branch: true,
          repoId: true,
          specApprovedAt: true,
          source: true,
          sprintId: true,
          runs: {
            select: {
              status: true,
              paneId: true,
              startedAt: true,
              agent: { select: { id: true, name: true } }
            },
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
      agent: runs.find(run => run.status === 'RUNNING')?.agent ?? null,
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
          : this.prisma.repo.findMany({
              where: { projects: { some: { id: ticket.projectId } } },
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
      source: ticket.source,
      issueType: ticket.issueType,
      specFile: ticket.specFile,
      sprintId: ticket.sprintId,
      parent: ticket.parentKey
        ? {
            key: ticket.parentKey,
            summary: ticket.parentSummary,
            description: ticket.parentDescription,
            // jiraUrl is <site>/browse/<key>; swap in the parent key.
            jiraUrl: ticket.jiraUrl.replace(/[^/]+$/, ticket.parentKey)
          }
        : null,
      sprintSource: ticket.sprint?.source ?? null,
      projectSpecSource: ticket.project?.specSource ?? null,
      jiraUrl: ticket.jiraUrl,
      status: ticket.status,
      projectId: ticket.projectId,
      repoId: ticket.repoId,
      branch: ticket.branch,
      specAgent: ticket.specAgentRef,
      devAgent: ticket.devAgentRef,
      testAgent: ticket.testAgentRef,
      skills: ticket.skills,
      rules: ticket.rules,
      extraInstructions: ticket.extraInstructions,
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

  async move(
    id: number,
    to: TicketStatus,
    branch?: { base: string; name: string; push: boolean }
  ): Promise<TicketDetail> {
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
      if (to === 'IN_PROGRESS' && ticket.branch === null)
        await this.createBranch(ticket, branch);
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

  // First move to In Progress: cut the ticket branch before any agent runs.
  private async createBranch(
    ticket: { id: number; repoId: number | null },
    branch?: { base: string; name: string; push: boolean }
  ) {
    if (!branch) throw new ConflictException('Branch required');
    if (ticket.repoId === null)
      throw new BadRequestException('Ticket has no repo');
    const repo = await this.prisma.repo.findUnique({
      where: { id: ticket.repoId }
    });
    if (!repo) throw new BadRequestException('Ticket has no repo');
    const { tickets: busy } = await this.repoConflicts(ticket.id);
    if (busy.length)
      throw new ConflictException(
        `Repo is busy with ${busy.map(t => t.jiraKey).join(', ')}`
      );
    await this.git.assertBranchName(branch.name);
    if (!(await this.git.isClean(repo.path)))
      throw new ConflictException('Repo has uncommitted changes');
    if (await this.git.branchExists(repo.path, branch.name))
      throw new ConflictException(`Branch ${branch.name} already exists`);
    await this.git.createBranch(repo.path, branch.base, branch.name);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { branch: branch.name }
    });
    if (branch.push) {
      try {
        await this.git.push(repo.path, branch.name);
      } catch (error) {
        // The local branch stays checked out and saved; the owner pushes it by hand.
        throw new BadGatewayException(
          `Branch created but push failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
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
    const data: Prisma.TicketUncheckedUpdateInput = {};
    let projectId = ticket.projectId;
    let specSource = ticket.project?.specSource ?? 'JIRA';
    if (input.projectId !== undefined && input.projectId !== ticket.projectId) {
      if (ticket.status !== 'TODO')
        throw new ConflictException('Project can only change while in To Do');
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId }
      });
      if (!project) throw new NotFoundException('Project not found');
      projectId = project.id;
      specSource = project.specSource;
      Object.assign(data, {
        projectId: project.id,
        repoId: project.defaultRepoId,
        branch: null,
        specAgentId: project.specAgentId,
        devAgentId: project.devAgentId,
        testAgentId: project.testAgentId,
        // A LOCAL sprint belongs to the old project.
        ...(ticket.sprint?.source === 'LOCAL' && input.sprintId === undefined
          ? { sprintId: null }
          : {})
      });
    }
    if (input.repoId !== undefined && input.repoId !== ticket.repoId) {
      if (
        input.repoId !== null &&
        !(await this.prisma.repo.findFirst({
          where: {
            id: input.repoId,
            projects: { some: { id: projectId ?? undefined } }
          }
        }))
      )
        throw new BadRequestException('Repo does not belong to the project');
      if (await this.runningCount(id))
        throw new ConflictException('Repo is locked while an agent runs');
      data.repoId = input.repoId;
      // The saved branch belongs to the old repo.
      if (ticket.branch !== null) data.branch = null;
    }
    const steps = {
      specAgentId: ['SPEC', 'BA'],
      devAgentId: ['DEV', 'DEV'],
      testAgentId: ['TEST', 'QC']
    } as const;
    for (const key of Object.keys(steps) as (keyof typeof steps)[]) {
      if (input[key] === undefined || input[key] === ticket[key]) continue;
      const [step, role] = steps[key];
      if (await this.runningCount(id, step))
        throw new ConflictException(`${step} agent is locked while it runs`);
      await this.profiles.assertRole(input[key], role);
      data[key] = input[key];
    }
    if (input.sprintId !== undefined && input.sprintId !== ticket.sprintId) {
      await this.assertSprint(
        { source: ticket.source, sprintSource: ticket.sprint?.source ?? null },
        projectId,
        input.sprintId,
        specSource
      );
      data.sprintId = input.sprintId;
    }
    if (input.extraInstructions !== undefined)
      data.extraInstructions = input.extraInstructions;
    if (input.skillIds !== undefined)
      data.skills = { set: input.skillIds.map(id => ({ id })) };
    if (input.ruleIds !== undefined)
      data.rules = { set: input.ruleIds.map(id => ({ id })) };
    await this.prisma.ticket.update({ where: { id }, data });
    this.emit(ticket.projectId);
    if (projectId !== ticket.projectId) this.emit(projectId);
    return this.detail(id);
  }

  private async assertSprint(
    ticket: Parameters<typeof assertSprintAssignable>[0],
    projectId: number | null,
    sprintId: number | null,
    specSource: SpecSource
  ) {
    let sprint: Parameters<typeof assertSprintAssignable>[1] = null;
    if (sprintId !== null) {
      const found = await this.prisma.sprint.findUnique({
        where: { id: sprintId }
      });
      if (!found) throw new NotFoundException('Sprint not found');
      sprint = {
        source: found.source,
        state: found.state,
        visibleInProject:
          projectId !== null &&
          (found.source === 'LOCAL'
            ? found.projectId === projectId
            : (await this.prisma.ticket.count({
                where: { projectId, sprintId }
              })) > 0)
      };
    }
    assertSprintAssignable(ticket, sprint, specSource);
  }

  private async find(id: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            workspaceId: true,
            specDir: true,
            specSource: true
          }
        },
        sprint: { select: { source: true } },
        specAgentRef: AGENT_REF,
        devAgentRef: AGENT_REF,
        testAgentRef: AGENT_REF,
        skills: {
          select: { id: true, name: true, provider: true, command: true }
        },
        rules: { select: { id: true, name: true } }
      }
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
