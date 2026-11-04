import { useCallback, useEffect } from 'react';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import {
  RequestMethods,
  useMutationEnhancer,
  useQueryEnhancer
} from '@truyenmoinhu/query';
import { UIUtils } from '@truyenmoinhu/uikit';

import { ROUTE_PATHS } from '#constants/routes';
import { trans } from '#i18n';

import {
  ATTENTION_REFETCH_MS,
  ATTENTION_TOAST_KEY,
  RUNS_REFETCH_MS,
  SCHEDULED_TASK_ENDPOINTS,
  SCHEDULED_TASK_QUERY_KEYS
} from './constants';
import { ScheduledTasksError } from './error';
import { errorMessage } from './utils';

import type {
  IAttentionItem,
  ISaveScheduledTask,
  IScheduledRunsPage,
  IScheduledTask,
  IScheduledTaskRequest
} from './types';

export const useScheduledTasks = () =>
  useQueryEnhancer<IScheduledTask[]>({
    queryKey: [SCHEDULED_TASK_QUERY_KEYS.list],
    refetchInterval: RUNS_REFETCH_MS,
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IScheduledTask[]>({
        url: SCHEDULED_TASK_ENDPOINTS.tasks(),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new ScheduledTasksError(result?.code);
      }
      return result.payload;
    }
  });

export const useScheduledRuns = (taskId: number | undefined, page: number) =>
  useQueryEnhancer<IScheduledRunsPage>({
    queryKey: [SCHEDULED_TASK_QUERY_KEYS.runs, taskId, page],
    enabled: taskId !== undefined,
    placeholderData: keepPreviousData,
    refetchInterval: RUNS_REFETCH_MS,
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IScheduledRunsPage>({
        url: SCHEDULED_TASK_ENDPOINTS.tasks(`${taskId}/runs`, { page }),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new ScheduledTasksError(result?.code);
      }
      return result.payload;
    }
  });

export const useAttentionRuns = () =>
  useQueryEnhancer<IAttentionItem[]>({
    queryKey: [SCHEDULED_TASK_QUERY_KEYS.attention],
    refetchInterval: ATTENTION_REFETCH_MS,
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IAttentionItem[]>({
        url: SCHEDULED_TASK_ENDPOINTS.runs('attention'),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new ScheduledTasksError(result?.code);
      }
      return result.payload;
    }
  });

// Warns once per browser session; the menu badge keeps pointing at the page afterwards.
export const useAttentionToast = () => {
  const count = useAttentionRuns().data?.length ?? 0;
  const navigate = useNavigate();
  useEffect(() => {
    if (count === 0 || sessionStorage.getItem(ATTENTION_TOAST_KEY)) {
      return;
    }
    sessionStorage.setItem(ATTENTION_TOAST_KEY, '1');
    UIUtils.notify.warning({
      message: trans('scheduled.attention_toast', { count }),
      data: {
        action: {
          label: trans('scheduled.attention_toast_action'),
          onClick: () => navigate({ to: ROUTE_PATHS.scheduledTasks })
        }
      }
    });
  }, [count, navigate]);
};

export const useRunOutput = (runId: number | undefined, enabled: boolean) =>
  useQueryEnhancer<{ content: string }>({
    queryKey: [SCHEDULED_TASK_QUERY_KEYS.output, runId],
    enabled: enabled && runId !== undefined,
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<{ content: string }>({
        url: SCHEDULED_TASK_ENDPOINTS.runs(`${runId}/output`),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new ScheduledTasksError(result?.code, result?.message);
      }
      return result.payload;
    }
  });

// Every mutation changes tasks, run history and the attention list, so all three are refreshed.
const useScheduledMutation = <TVariables>(
  build: (variables: TVariables) => IScheduledTaskRequest & {
    endpoint: 'tasks' | 'runs';
  }
) => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<unknown, TVariables>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!apiManager || variables === undefined) {
        throw new ScheduledTasksError();
      }
      const { endpoint, path, method, data } = build(variables);
      const result = await apiManager.sendRequest<unknown>({
        url: SCHEDULED_TASK_ENDPOINTS[endpoint](path),
        method,
        data,
        suppressNotifyOnError: true
      });
      await Promise.all(
        [
          SCHEDULED_TASK_QUERY_KEYS.list,
          SCHEDULED_TASK_QUERY_KEYS.runs,
          SCHEDULED_TASK_QUERY_KEYS.attention
        ].map(queryKey =>
          queryClient.invalidateQueries({ queryKey: [queryKey] })
        )
      );
      if (!result.success) {
        throw new ScheduledTasksError(result.code, result.message);
      }
      return result.payload;
    }
  });
};

export const useSaveScheduledTask = () =>
  useScheduledMutation<
    ISaveScheduledTask | Pick<ISaveScheduledTask, 'id' | 'enabled'>
  >(({ id, ...data }) => ({
    endpoint: 'tasks',
    path: id === undefined ? undefined : String(id),
    method: id === undefined ? RequestMethods.POST : RequestMethods.PATCH,
    data
  }));

export const useDeleteScheduledTask = () =>
  useScheduledMutation<number>(id => ({
    endpoint: 'tasks',
    path: String(id),
    method: RequestMethods.DELETE
  }));

export const useRunScheduledTask = () =>
  useScheduledMutation<number>(id => ({
    endpoint: 'tasks',
    path: `${id}/run`,
    method: RequestMethods.POST
  }));

export const useRerunRun = () =>
  useScheduledMutation<number>(id => ({
    endpoint: 'runs',
    path: `${id}/rerun`,
    method: RequestMethods.POST
  }));

export const useDismissRun = () =>
  useScheduledMutation<number>(id => ({
    endpoint: 'runs',
    path: `${id}/dismiss`,
    method: RequestMethods.POST
  }));

export const useStopRun = () =>
  useScheduledMutation<number>(id => ({
    endpoint: 'runs',
    path: `${id}/stop`,
    method: RequestMethods.POST
  }));

// Confirms, then deletes; the daemon answers 409 when the task is running.
export const useConfirmDeleteScheduledTask = () => {
  const { mutateAsync } = useDeleteScheduledTask();
  // Stable identity: the table memoizes its columns on this.
  return useCallback(
    (id: number, name: string) => {
      const modal = `scheduled-delete-${id}`;
      UIUtils.alert.open({
        name: modal,
        title: trans('scheduled.delete_title'),
        message: trans('scheduled.delete_message', { name }),
        cancelTitle: trans('scheduled.cancel'),
        actions: () => [
          {
            kind: 'primary',
            children: trans('scheduled.delete'),
            onClick: async () => {
              UIUtils.alert.dismissByName(modal);
              try {
                await mutateAsync(id);
                UIUtils.notify.success(trans('scheduled.deleted'));
              } catch (e) {
                UIUtils.notify.error(
                  e instanceof Error
                    ? errorMessage(e)
                    : trans('scheduled.action_failed')
                );
              }
            }
          }
        ]
      });
    },
    [mutateAsync]
  );
};
