import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';
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
  board: generateQueryKey('project-board')
};
export const TICKET_ENDPOINTS = {
  tickets: withGenerateEndpoint('tickets'),
  projects: withGenerateEndpoint('projects')
};
export const UNASSIGNED_COLUMN = 'store-col-none';
