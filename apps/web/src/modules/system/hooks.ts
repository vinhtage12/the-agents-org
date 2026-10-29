import { useQueryEnhancer } from '@truyenmoinhu/query';

import { SYSTEM_ENDPOINTS, SYSTEM_QUERY_KEYS } from './constants';

import type { IDocker, IUsageResponse } from './types';
export const useDocker = () =>
  useQueryEnhancer<IDocker>({
    queryKey: [SYSTEM_QUERY_KEYS.docker],
    refetchInterval: 10000,
    queryFn: async ({ apiManager }) => {
      const res = await apiManager?.sendRequest<IDocker>({
        url: SYSTEM_ENDPOINTS.docker(),
        suppressNotifyOnError: true
      });
      if (!res?.success || !res.payload) {
        throw new Error('Docker unavailable');
      }
      return res.payload;
    }
  });
export const useUsage = () =>
  useQueryEnhancer<IUsageResponse>({
    queryKey: [SYSTEM_QUERY_KEYS.usage],
    refetchInterval: 60000,
    queryFn: async ({ apiManager }) => {
      const res = await apiManager?.sendRequest<IUsageResponse>({
        url: SYSTEM_ENDPOINTS.usage(),
        suppressNotifyOnError: true
      });
      if (!res?.success || !res.payload) {
        throw new Error('Usage unavailable');
      }
      return res.payload;
    }
  });
