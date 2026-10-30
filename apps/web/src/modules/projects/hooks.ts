import { useQueryClient } from '@tanstack/react-query';

import { useMutationEnhancer, useQueryEnhancer } from '@truyenmoinhu/query';

import { PROJECT_ENDPOINTS, PROJECT_QUERY_KEYS } from './constants';
import { ProjectError } from './error';
import { settingsPath } from './utils';

import type {
  IAgentProfileList,
  IProjectMutationVariables,
  IProjectSettings
} from './types';
export const useProjectSettings = (workspaceId: number, projectId: number) =>
  useQueryEnhancer<IProjectSettings>({
    queryKey: [PROJECT_QUERY_KEYS.settings, workspaceId, projectId],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IProjectSettings>({
        url: settingsPath(workspaceId, projectId),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new ProjectError(result?.code);
      }
      return result.payload;
    }
  });
export const useAgentProfiles = () =>
  useQueryEnhancer<IAgentProfileList>({
    queryKey: [PROJECT_QUERY_KEYS.agentProfiles],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IAgentProfileList>({
        url: PROJECT_ENDPOINTS.agentProfiles(),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new ProjectError(result?.code);
      }
      return result.payload;
    }
  });
export const useProjectSettingsMutation = <
  TResponse = unknown,
  TData = unknown
>() => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<TResponse, IProjectMutationVariables<TData>>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!apiManager || !variables) {
        throw new ProjectError();
      }
      const result = await apiManager.sendRequest<TResponse>({
        ...variables,
        suppressNotifyOnError: true
      });
      if (!result.success) {
        throw new ProjectError(result.code);
      }
      // DELETE 204 has no ID, so invalidate explicitly.
      await queryClient.invalidateQueries({
        queryKey: [PROJECT_QUERY_KEYS.settings]
      });
      return result.payload;
    }
  });
};
