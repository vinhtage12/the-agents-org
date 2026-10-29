import { HttpStatusCode, useQueryEnhancer } from '@truyenmoinhu/query';

import { ENDPOINTS, QUERY_KEYS } from '#constants/query';

import type { IHealth } from 'dto/types';
/**
 * Daemon health. `null` = daemon unreachable; a 503 still means the daemon is
 * up but its database is not.
 */
export const useHealth = () =>
  useQueryEnhancer<IHealth | null>({
    queryKey: [QUERY_KEYS.health],
    queryFn: async ({ apiManager }) => {
      const res = await apiManager?.sendRequest<IHealth>({
        url: ENDPOINTS.health(),
        suppressNotifyOnError: true
      });
      if (res?.success) {
        return res.payload;
      }
      if (res?.code === HttpStatusCode.ServiceUnavailable) {
        return { status: 'ok', db: 'down' };
      }
      return null;
    }
  });
