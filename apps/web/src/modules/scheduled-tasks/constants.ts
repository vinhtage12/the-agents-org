import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';

import { ScheduledRunStatus } from './enum';

export const SCHEDULED_TASK_QUERY_KEYS = {
  list: generateQueryKey('scheduled-tasks'),
  runs: generateQueryKey('scheduled-task-runs'),
  attention: generateQueryKey('scheduled-attention'),
  output: generateQueryKey('scheduled-run-output')
};

export const SCHEDULED_TASK_ENDPOINTS = {
  tasks: withGenerateEndpoint('scheduled-tasks'),
  runs: withGenerateEndpoint('scheduled-runs')
};

export const ATTENTION_REFETCH_MS = 30_000;
export const RUNS_REFETCH_MS = 30_000;
export const DEFAULT_TASK_TIME = '08:30';
// Display order Mon..Sun; values follow Date.getDay() (0 = Sunday).
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
export const ATTENTION_TOAST_KEY = 'scheduled-attention-toast';
export const SCHEDULED_TASK_DIALOG = 'scheduled-task-dialog';
export const SCHEDULED_HISTORY_DIALOG = 'scheduled-history-dialog';
export const SCHEDULED_OUTPUT_DIALOG = 'scheduled-output-dialog';
// Must match the daemon's RUNS_PAGE_SIZE for GET scheduled-tasks/:id/runs.
export const RUNS_PAGE_SIZE = 20;

export const RUN_STATUS_COLORS = {
  [ScheduledRunStatus.RUNNING]: 'blue',
  [ScheduledRunStatus.COMPLETED]: 'green',
  [ScheduledRunStatus.FAILED]: 'red',
  [ScheduledRunStatus.STOPPED]: 'gray',
  [ScheduledRunStatus.MISSED]: 'orange',
  [ScheduledRunStatus.SKIPPED]: 'gray'
} as const;
