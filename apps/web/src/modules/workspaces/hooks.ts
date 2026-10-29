import { useQueryClient } from '@tanstack/react-query';

import { useMutationEnhancer, useQueryEnhancer } from '@truyenmoinhu/query';

import { WORKSPACE_ENDPOINTS, WORKSPACE_QUERY_KEYS } from './constants';
import { write } from './utils';

import type { IWorkspace, IWorkspaceMutationVariables } from './types';
export const useWorkspaces = () =>
  useQueryEnhancer<IWorkspace[]>({
    queryKey: [WORKSPACE_QUERY_KEYS.base],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IWorkspace[]>({
        url: WORKSPACE_ENDPOINTS.base(),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new Error('workspace_load_failed');
      }
      return result.payload;
    }
  });
export const useWorkspaceMutation = <
  TResponse = unknown,
  TData = unknown
>() => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<TResponse, IWorkspaceMutationVariables<TData>>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!variables) {
        throw new Error('Missing mutation variables');
      }
      const payload = await write<TResponse, TData>(apiManager, variables);
      // Invalidate here even for DELETE 204 (there is no response ID for the wrapper's default invalidation).
      await queryClient.invalidateQueries({
        queryKey: [WORKSPACE_QUERY_KEYS.base]
      });
      return payload;
    }
  });
};
