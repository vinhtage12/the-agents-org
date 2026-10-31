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
  TODO: ['IN_SPEC'],
  IN_REVIEW_SPEC: ['IN_PROGRESS'],
  IN_TESTING: ['IN_REVIEW'],
  IN_REVIEW: ['DONE']
};
export const DROP_TARGETS = new Set(Object.values(MOVABLE).flat());
// Moves into these steps start an agent, so overlapping repos are warned about.
export const AGENT_START_STATUSES: TicketStatus[] = ['IN_SPEC', 'IN_PROGRESS'];
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
export const AGENT_STEPS = ['specAgent', 'devAgent', 'testAgent'] as const;
export const TICKET_DIALOG = 'ticket-dialog';
// No typography plugin: style rendered markdown from the wrapper.
export const MARKDOWN_CLASS =
  'text-sm leading-6 [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-bold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_a]:text-primary [&_a]:underline [&_table]:my-2 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2';
