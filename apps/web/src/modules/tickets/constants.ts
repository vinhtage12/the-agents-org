import { generateQueryKey } from '@truyenmoinhu/query';

import { AgentRole } from '#modules/warehouse/enum';
import { withGenerateEndpoint } from '#utils/query';

import { BoardLabel, TicketStatus } from './enum';

export const TICKET_STATUSES = Object.values(TicketStatus);
export const TICKET_QUERY_KEYS = {
  store: generateQueryKey('ticket-store'),
  board: generateQueryKey('project-board'),
  sprints: generateQueryKey('project-sprints'),
  detail: generateQueryKey('ticket-detail'),
  output: generateQueryKey('agent-output'),
  gitBranches: generateQueryKey('git-branches'),
  specFiles: generateQueryKey('spec-files')
};
// Drag moves the daemon accepts (its assertTransition table).
export const MOVABLE: Partial<Record<TicketStatus, TicketStatus[]>> = {
  [TicketStatus.TODO]: [TicketStatus.IN_SPEC],
  [TicketStatus.IN_REVIEW_SPEC]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_TESTING]: [TicketStatus.IN_REVIEW],
  [TicketStatus.IN_REVIEW]: [TicketStatus.DONE]
};
export const DROP_TARGETS = new Set(Object.values(MOVABLE).flat());
// Moves into these steps start an agent, so overlapping repos are warned about.
export const AGENT_START_STATUSES = [
  TicketStatus.IN_SPEC,
  TicketStatus.IN_PROGRESS
];
export const LABEL_COLORS: Record<BoardLabel, 'blue' | 'green' | 'orange'> = {
  [BoardLabel.RUNNING]: 'blue',
  [BoardLabel.APPROVED]: 'green',
  [BoardLabel.NEEDS_YOU]: 'orange'
};
export const BOARD_EVENT = 'board-changed';
export const TICKET_ENDPOINTS = {
  tickets: withGenerateEndpoint('tickets'),
  projects: withGenerateEndpoint('projects'),
  repositories: withGenerateEndpoint('repositories'),
  agents: withGenerateEndpoint('agents'),
  sprints: withGenerateEndpoint('sprints'),
  workspaces: withGenerateEndpoint('workspaces')
};
export const MAX_FIX_ROUNDS = 2;
export const OUTPUT_REFETCH_MS = 2000;
export const OUTPUT_LINES = 200;
export const UNASSIGNED_COLUMN = 'store-col-none';
// Settings field -> agent role the daemon accepts for that step.
export const AGENT_STEPS = [
  { step: 'specAgent', role: AgentRole.BA },
  { step: 'devAgent', role: AgentRole.DEV },
  { step: 'testAgent', role: AgentRole.QC }
] as const;
export const BRANCH_DIALOG = 'branch-dialog';
export const BRANCH_TYPES = [
  'feat',
  'bug',
  'hotfix',
  'refactor',
  'chore',
  'docs',
  'test'
] as const;
export const TICKET_DIALOG = 'ticket-dialog';
// No typography plugin: style rendered markdown from the wrapper.
export const MARKDOWN_CLASS =
  'text-sm leading-6 [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-bold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_a]:text-primary [&_a]:underline [&_table]:my-2 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2';
export const SPRINT_ALL = 'all';
// Select item values cannot be empty, so the default filter has its own value.
export const SPRINT_RUNNING = 'running';
export const SPRINT_DIALOG = 'sprint-dialog';
export const COMPLETE_SPRINT_DIALOG = 'complete-sprint-dialog';
export const SPRINT_NEW = 'new';
export const SPRINT_BACKLOG = 'backlog';
export const LOCAL_TICKET_DIALOG = 'local-ticket-dialog';
export const ISSUE_TYPES = ['Task', 'Bug', 'Story'] as const;
