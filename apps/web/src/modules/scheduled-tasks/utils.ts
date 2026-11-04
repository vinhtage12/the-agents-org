import { trans } from '#i18n';

import { DEFAULT_TASK_TIME } from './constants';

import type {
  ISaveScheduledTask,
  IScheduledTask,
  IScheduledTaskFormValues
} from './types';

const MINUTES_PER_HOUR = 60;
const pad = (value: number) => String(value).padStart(2, '0');

export const toTimeString = (time: number): string =>
  `${pad(Math.floor(time / MINUTES_PER_HOUR))}:${pad(time % MINUTES_PER_HOUR)}`;

export const fromTimeString = (value: string): number => {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

export const formatSchedule = (time: number, days: number[]): string => {
  const label =
    days.length === 7
      ? trans('scheduled.every_day')
      : [...days]
          .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
          .map(day => trans(`scheduled.day.${day}`))
          .join(', ');
  return `${toTimeString(time)} (${label})`;
};

// ScheduledTasksError carries the daemon message only when there is one.
export const errorMessage = (e: Error): string =>
  e.message || trans('scheduled.action_failed');

export const toFormValues = (
  task?: IScheduledTask
): IScheduledTaskFormValues => ({
  name: task?.name ?? '',
  time: task ? toTimeString(task.time) : DEFAULT_TASK_TIME,
  days: task?.days ?? [],
  agentId: task ? String(task.agentId) : '',
  repos: (task?.repos ?? []).map(repo => ({
    ...repo,
    description: '',
    updatedAt: ''
  })),
  outputDir: task?.outputDir ?? '',
  prompt: task?.prompt ?? ''
});

export const toSaveTask = (
  values: IScheduledTaskFormValues,
  id?: number
): ISaveScheduledTask => ({
  id,
  name: values.name.trim(),
  time: fromTimeString(values.time),
  days: values.days,
  agentId: Number(values.agentId),
  repoIds: values.repos.map(repo => repo.id),
  outputDir: values.outputDir.trim(),
  prompt: values.prompt
});

// navigator.clipboard is undefined outside secure contexts (the app is served over plain http).
// The fallback textarea goes inside `container` so a dialog's focus trap keeps the selection.
export const copyText = async (
  text: string,
  container: HTMLElement = document.body
): Promise<boolean> => {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  const area = document.createElement('textarea');
  try {
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.opacity = '0';
    container.appendChild(area);
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
};
