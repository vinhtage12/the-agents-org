import {
  MOVABLE,
  SPRINT_ALL,
  SPRINT_BACKLOG,
  UNASSIGNED_COLUMN
} from './constants';

import type {
  IBoardSplit,
  IBoardTicket,
  ILinkTicket,
  ISprint,
  IStoreTicket,
  ITicketDetail,
  ITicketSettingsValues,
  IUpdateTicket,
  TicketPlacement,
  TicketSource
} from './types';

export const buildInitialPlacement = (
  tickets: IStoreTicket[]
): TicketPlacement =>
  Object.fromEntries(tickets.map(t => [t.id, t.suggestedProjectId]));

export const toLinks = (placement: TicketPlacement): ILinkTicket[] =>
  Object.entries(placement).flatMap(([ticketId, projectId]) =>
    projectId === null ? [] : [{ ticketId: Number(ticketId), projectId }]
  );

export const columnId = (projectId: number | null) =>
  projectId === null ? UNASSIGNED_COLUMN : `store-col-${projectId}`;

// Ignores moves for tickets that disappeared after a re-sync.
export const applyMoves = (
  initial: TicketPlacement,
  moved: TicketPlacement
): TicketPlacement =>
  Object.fromEntries(
    Object.entries(initial).map(([id, projectId]) => [
      id,
      Number(id) in moved ? (moved[Number(id)] ?? null) : projectId
    ])
  );

// A project change resets repo and agents to the new project's defaults on the daemon.
export const toTicketUpdate = (
  values: ITicketSettingsValues,
  ticket: ITicketDetail
): IUpdateTicket => {
  const extras = {
    skillIds: values.skills.map(s => s.id),
    ruleIds: values.rules.map(r => r.id),
    extraInstructions: values.extraInstructions
  };
  const projectId = Number(values.projectId);
  if (projectId && projectId !== ticket.projectId) {
    return { projectId, ...extras };
  }
  const sprintId =
    values.sprint === SPRINT_BACKLOG ? null : Number(values.sprint);
  return {
    // Unchanged is omitted: Jira-owned sprints reject writes.
    ...(sprintId !== ticket.sprintId ? { sprintId } : {}),
    repoId: values.repoId ? Number(values.repoId) : null,
    specAgentId: values.specAgent?.id ?? null,
    devAgentId: values.devAgent?.id ?? null,
    testAgentId: values.testAgent?.id ?? null,
    ...extras
  };
};

export const canDrag = (ticket: IBoardTicket) => {
  if (!MOVABLE[ticket.status]) {
    return false;
  }
  if (ticket.status === 'IN_REVIEW_SPEC') {
    return ticket.label === 'approved';
  }
  if (ticket.status === 'IN_TESTING') {
    return ticket.label !== 'running';
  }
  return true;
};

// undefined = the running sprints; no running sprint behaves like 'all'.
export const filterBoard = (
  tickets: IBoardTicket[],
  sprints: ISprint[],
  filter: string | undefined
): IBoardSplit => {
  const ids = new Set(
    filter === undefined
      ? sprints.filter(s => s.state === 'ACTIVE').map(s => s.id)
      : [Number(filter)]
  );
  if (filter === SPRINT_ALL || (filter === undefined && !ids.size)) {
    return { columns: tickets, backlog: [] };
  }
  return {
    columns: tickets.filter(t => t.sprintId !== null && ids.has(t.sprintId)),
    backlog: tickets.filter(t => t.sprintId === null)
  };
};

// Earliest start first (no date last), then oldest.
export const defaultCompleteTarget = (futures: ISprint[]): string => {
  const first = [...futures].sort(
    (a, b) =>
      (a.startDate ?? '9').localeCompare(b.startDate ?? '9') || a.id - b.id
  )[0];
  return first ? String(first.id) : 'new';
};

// Spec 5.8: Jira tickets take LOCAL sprints; LOCAL tickets also take Jira sprints in Hybrid projects.
export const selectableSprints = (
  sprints: ISprint[],
  ticketSource: TicketSource,
  hybrid: boolean,
  currentId: number | null = null
): ISprint[] =>
  sprints.filter(
    s =>
      s.id === currentId ||
      (s.state !== 'CLOSED' &&
        (s.source === 'LOCAL' || (ticketSource === 'LOCAL' && hybrid)))
  );
