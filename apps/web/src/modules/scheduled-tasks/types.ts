import type { RequestMethods } from '@truyenmoinhu/query';
import type { IRepo } from '#modules/warehouse';
import type { ScheduledRunStatus, ScheduledRunTrigger } from './enum';

export interface IScheduledRun {
  id: number;
  taskId: number;
  scheduledFor: string;
  trigger: ScheduledRunTrigger;
  status: ScheduledRunStatus;
  rerunOfId: number | null;
  dismissedAt: string | null;
  agentId: number | null;
  agentName: string;
  paneId: string | null;
  outputPath: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface IScheduledTask {
  id: number;
  name: string;
  slug: string;
  prompt: string;
  enabled: boolean;
  time: number;
  days: number[];
  agentId: number;
  outputDir: string;
  checkedUntil: string;
  createdAt: string;
  updatedAt: string;
  agent: { id: number; name: string };
  repos: { id: number; name: string; path: string }[];
  lastRun: Pick<
    IScheduledRun,
    'id' | 'status' | 'scheduledFor' | 'finishedAt'
  > | null;
  nextRunAt: string | null;
}

export interface IAttentionItem {
  id: number;
  taskId: number;
  taskName: string;
  status: ScheduledRunStatus.MISSED | ScheduledRunStatus.FAILED;
  scheduledFor: string;
  error: string | null;
}

export interface ISaveScheduledTask {
  id?: number;
  name: string;
  time: number;
  days: number[];
  agentId: number;
  repoIds: number[];
  outputDir: string;
  prompt: string;
  enabled?: boolean;
}

export interface IScheduledRunsPage {
  data: IScheduledRun[];
  total: number;
}

export interface IScheduledTaskRequest {
  path?: string;
  method?: RequestMethods;
  data?: unknown;
}

export interface IScheduledTaskFormValues {
  name: string;
  time: string;
  days: number[];
  agentId: string;
  repos: IRepo[];
  outputDir: string;
  prompt: string;
}

export interface IScheduledTaskDialogParams {
  task?: IScheduledTask;
}

export interface IScheduledHistoryDialogParams {
  task: IScheduledTask;
}
