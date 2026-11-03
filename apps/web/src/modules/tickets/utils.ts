import { MOVABLE, UNASSIGNED_COLUMN } from './constants';

import type {
  IBoardTicket,
  ILinkTicket,
  IStoreTicket,
  ITicketDetail,
  ITicketSettingsValues,
  IUpdateTicket,
  TicketPlacement
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
  return {
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
