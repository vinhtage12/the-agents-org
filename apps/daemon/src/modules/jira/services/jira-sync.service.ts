import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';
import { BoardGateway } from '#modules/agent-runs/gateways/board.gateway';
import { AgentRunsService } from '#modules/agent-runs/services/agent-runs.service';

import {
  JiraClient,
  JiraHttpError,
  JiraIssue,
  JiraSprint
} from '../clients/jira.client';
import {
  effectiveState,
  nextSprintId,
  pickSprint,
  rolloverTarget
} from '../utils/sprint-rules';

interface SprintCtx {
  on: boolean;
  ids: Map<number, number>;
  closed: Set<number>;
  openIds: Set<number>;
}
const DONE = ['DONE', 'CANCELED'] as const;

@Injectable()
export class JiraSyncService {
  private readonly logger = new Logger(JiraSyncService.name);
  private warnedAgile = false;
  constructor(
    private readonly jira: JiraClient,
    private readonly prisma: PrismaService,
    private readonly agentRuns: AgentRunsService,
    private readonly board: BoardGateway
  ) {}
  private content(issue: JiraIssue, parents: Map<string, JiraIssue>) {
    const parent = issue.parentKey ? parents.get(issue.parentKey) : undefined;
    return {
      summary: issue.summary,
      description: issue.description,
      issueType: issue.issueType,
      jiraStatus: issue.status,
      jiraUrl: this.jira.browseUrl(issue.key),
      parentKey: issue.parentKey,
      parentSummary: parent?.summary ?? null,
      parentDescription: parent?.description ?? null
    };
  }
  // Search results only carry the parent key; its summary and description need their own lookup.
  private async loadParents(
    issues: JiraIssue[],
    parents: Map<string, JiraIssue>
  ) {
    const keys = [
      ...new Set(
        issues
          .map(issue => issue.parentKey)
          .filter((key): key is string => !!key && !parents.has(key))
      )
    ];
    for (let i = 0; i < keys.length; i += 50)
      for (const parent of await this.recheck(keys.slice(i, i + 50)))
        parents.set(parent.key, parent);
  }
  async sync() {
    if (!this.jira.isConfigured())
      throw new ServiceUnavailableException('Jira is not configured');
    const me = await this.jira.myself();
    const issues = await this.jira.search(
      'assignee = currentUser() AND statusCategory != Done'
    );
    const parents = new Map<string, JiraIssue>();
    await this.loadParents(issues, parents);
    const result = {
      created: 0,
      updated: 0,
      canceled: 0,
      reopened: 0,
      sprints: 0
    };
    const ctx: SprintCtx = {
      on: (await this.jira.sprintFieldId()) !== null,
      ids: new Map(),
      closed: new Set(),
      openIds: new Set()
    };
    if (ctx.on)
      for (const s of await this.prisma.sprint.findMany({
        where: { source: 'JIRA', state: { not: 'CLOSED' } }
      }))
        ctx.openIds.add(s.id);
    const changed = new Set<number>();
    const sprintMoved = (
      before: { projectId: number | null; sprintId?: number | null } | null,
      data: { sprintId?: number | null }
    ) => {
      if (
        before?.projectId != null &&
        data.sprintId !== undefined &&
        data.sprintId !== (before.sprintId ?? null)
      )
        changed.add(before.projectId);
    };
    for (const issue of issues) {
      const existing = await this.prisma.ticket.findUnique({
        where: { jiraKey: issue.key },
        include: { sprint: true }
      });
      if (existing?.source === 'LOCAL') continue;
      const data = {
        ...this.content(issue, parents),
        ...(await this.sprintPatch(ctx, issue, existing?.sprint ?? null))
      };
      sprintMoved(existing, data);
      if (!existing) {
        try {
          await this.prisma.ticket.create({
            data: { ...data, jiraKey: issue.key, status: 'TODO' }
          });
          result.created++;
        } catch (error) {
          if (
            typeof error !== 'object' ||
            error === null ||
            !('code' in error) ||
            error.code !== 'P2002'
          )
            throw error;
          // Another sync created this key; update only Jira content, preserving any link/status.
          await this.prisma.ticket.update({
            where: { jiraKey: issue.key },
            data
          });
          result.updated++;
        }
      } else {
        const reopened = existing.status === 'CANCELED';
        await this.prisma.ticket.update({
          where: { jiraKey: issue.key },
          data: {
            ...data,
            ...(reopened ? { status: 'TODO' as const, fixRound: 0 } : {})
          }
        });
        if (reopened) result.reopened++;
        else result.updated++;
      }
    }
    const keys = new Set(issues.map(issue => issue.key));
    const missing = (
      await this.prisma.ticket.findMany({
        where: { source: 'JIRA', status: { notIn: [...DONE] } },
        include: { sprint: true }
      })
    ).filter(ticket => !keys.has(ticket.jiraKey));
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const checked = await this.recheck(batch.map(t => t.jiraKey));
      await this.loadParents(checked, parents);
      for (const ticket of batch) {
        const issue = checked.find(value => value.key === ticket.jiraKey);
        if (!issue || issue.assigneeAccountId !== me.accountId) {
          await this.agentRuns.closeTicketPanes(ticket.id);
          await this.prisma.ticket.update({
            where: { jiraKey: ticket.jiraKey },
            data: { status: 'CANCELED' }
          });
          if (ticket.projectId !== null)
            this.board.emitChanged(ticket.projectId);
          result.canceled++;
        } else {
          const data = {
            ...this.content(issue, parents),
            ...(await this.sprintPatch(ctx, issue, ticket.sprint ?? null))
          };
          sprintMoved(ticket, data);
          await this.prisma.ticket.update({
            where: { jiraKey: ticket.jiraKey },
            data
          });
          result.updated++;
        }
      }
    }
    for (const projectId of changed) this.board.emitChanged(projectId);
    if (ctx.on) await this.refreshSprints(ctx);
    for (const id of ctx.closed) await this.rollover(id);
    result.sprints = ctx.ids.size;
    return result;
  }
  private async upsertSprint(ctx: SprintCtx, s: JiraSprint) {
    const known = ctx.ids.get(s.id);
    if (known !== undefined) return known;
    const fields = {
      name: s.name,
      state: s.state.toUpperCase() as 'FUTURE' | 'ACTIVE' | 'CLOSED',
      startDate: s.startDate ? new Date(s.startDate) : null,
      endDate: s.endDate ? new Date(s.endDate) : null,
      jiraBoardId: s.boardId
    };
    const { id } = await this.prisma.sprint.upsert({
      where: { jiraSprintId: s.id },
      create: { source: 'JIRA', jiraSprintId: s.id, ...fields },
      update: fields
    });
    ctx.ids.set(s.id, id);
    if (fields.state === 'CLOSED' && ctx.openIds.has(id)) ctx.closed.add(id);
    return id;
  }
  private async sprintPatch(
    ctx: SprintCtx,
    issue: JiraIssue,
    current: { id: number; source: 'JIRA' | 'LOCAL' } | null
  ) {
    if (!ctx.on) return {};
    for (const s of issue.sprints) await this.upsertSprint(ctx, s);
    const picked = pickSprint(issue.sprints);
    const sprintId = nextSprintId(
      current,
      picked ? (ctx.ids.get(picked.id) ?? null) : null
    );
    return sprintId === undefined ? {} : { sprintId };
  }
  // Closed sprints rarely show up in synced issues, so ask Jira about every open one.
  private async refreshSprints(ctx: SprintCtx) {
    const now = new Date();
    const open = await this.prisma.sprint.findMany({
      where: { source: 'JIRA', state: { not: 'CLOSED' } }
    });
    for (const row of open) {
      if (ctx.closed.has(row.id) || row.jiraSprintId === null) continue;
      let data: object = {};
      let state = row.state;
      try {
        const fresh = await this.jira.getSprint(row.jiraSprintId);
        if (!fresh) continue;
        this.warnedAgile = false;
        state = fresh.state.toUpperCase() as typeof state;
        data = {
          name: fresh.name,
          startDate: fresh.startDate ? new Date(fresh.startDate) : null,
          endDate: fresh.endDate ? new Date(fresh.endDate) : null,
          jiraBoardId: fresh.boardId
        };
      } catch (error) {
        if (
          !(
            error instanceof JiraHttpError &&
            (error.jiraStatus === 401 || error.jiraStatus === 403)
          )
        )
          throw error;
        if (!this.warnedAgile)
          this.logger.warn(
            'Jira Agile API rejected the token (needs read:sprint:jira-software); using sprint end dates'
          );
        this.warnedAgile = true;
        // This sync's issue data is fresher than the end date.
        if (ctx.ids.get(row.jiraSprintId) === row.id) continue;
        state = effectiveState(row, now);
      }
      if (state === row.state && !Object.keys(data).length) continue;
      await this.prisma.sprint.update({
        where: { id: row.id },
        data: {
          ...data,
          state,
          ...(state === 'CLOSED' ? { completedAt: now } : {})
        }
      });
      if (state === 'CLOSED') ctx.closed.add(row.id);
    }
  }
  // The one place sync touches LOCAL tickets: move unfinished ones off a closed Jira sprint.
  private async rollover(sprintId: number) {
    const closed = await this.prisma.sprint.findUnique({
      where: { id: sprintId }
    });
    if (!closed) return;
    const where = {
      sprintId,
      source: 'LOCAL' as const,
      status: { notIn: [...DONE] }
    };
    const projectIds = new Set(
      (
        await this.prisma.ticket.findMany({
          where,
          select: { projectId: true }
        })
      )
        .map(t => t.projectId)
        .filter((id): id is number => id !== null)
    );
    const openSprints = await this.prisma.sprint.findMany({
      where: { source: 'JIRA', state: { not: 'CLOSED' } }
    });
    for (const projectId of projectIds) {
      const candidates = await this.prisma.sprint.findMany({
        where: {
          source: 'JIRA',
          state: { not: 'CLOSED' },
          tickets: { some: { projectId } }
        }
      });
      await this.prisma.ticket.updateMany({
        where: { ...where, projectId },
        data: { sprintId: rolloverTarget(closed, candidates, openSprints) }
      });
      this.board.emitChanged(projectId);
    }
  }
  // JQL `key in (...)` fails with 400 if any key was deleted or is no longer visible.
  private async recheck(keys: string[]): Promise<JiraIssue[]> {
    try {
      return await this.jira.search(`key in (${keys.join(',')})`);
    } catch (error) {
      if (!(error instanceof JiraHttpError && error.jiraStatus === 400))
        throw error;
      const issues = await Promise.all(
        keys.map(key => this.jira.getIssue(key))
      );
      return issues.filter((issue): issue is JiraIssue => issue !== null);
    }
  }
}
