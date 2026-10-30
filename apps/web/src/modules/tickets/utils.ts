import { UNASSIGNED_COLUMN } from './constants';

import type { ILinkTicket, IStoreTicket, TicketPlacement } from './types';

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
