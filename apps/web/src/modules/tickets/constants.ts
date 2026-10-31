import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';

import type { BoardLabel, TicketStatus } from './types';
export const TICKET_STATUSES = [
  'TODO',
  'IN_SPEC',
  'IN_REVIEW_SPEC',
  'IN_PROGRESS',
  'IN_TESTING',
  'IN_REVIEW',
  'DONE',
  'CANCELED'
] as const;
export const TICKET_QUERY_KEYS = {
  store: generateQueryKey('ticket-store'),
  board: generateQueryKey('project-board'),
  detail: generateQueryKey('ticket-detail')
};
// Drag moves the daemon accepts (its assertTransition table).
export const MOVABLE: Partial<Record<TicketStatus, TicketStatus[]>> = {
  TODO: ['IN_SPEC']
};
export const DROP_TARGETS = new Set(Object.values(MOVABLE).flat());
export const LABEL_COLORS: Record<BoardLabel, 'blue' | 'green' | 'orange'> = {
  running: 'blue',
  approved: 'green',
  needs_you: 'orange'
};
export const BOARD_EVENT = 'board-changed';
export const TICKET_ENDPOINTS = {
  tickets: withGenerateEndpoint('tickets'),
  projects: withGenerateEndpoint('projects')
};
export const UNASSIGNED_COLUMN = 'store-col-none';
