import {
  ApiManager,
  createQueryClient,
  generateQueryKey
} from '@truyenmoinhu/query';
import { UIUtils } from '@truyenmoinhu/uikit';

import { withGenerateEndpoint } from '#utils/query';

import { BASE_API_URL, BASE_API_VERSION } from './env';
export const ENDPOINTS = {
  health: withGenerateEndpoint('health'),
  agents: withGenerateEndpoint('agents'),
  agent: withGenerateEndpoint('agents')
};
export const apiManagerInstance = new ApiManager({
  config: {
    baseURL: `${BASE_API_URL}/${BASE_API_VERSION}`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8'
    },
    withCredentials: true
  },
  onSuccess: (response, { notifyOnSuccess }) => {
    if (!notifyOnSuccess) {
      return;
    }
    UIUtils.notify.success({ message: response?.data?.message });
  },
  onError: (err, { notifyOnError }) => {
    if (!notifyOnError) {
      return;
    }
    const message = err.response?.data?.message || err.message;
    // Same id → sonner collapses repeated failures into one toast.
    UIUtils.notify.error({ message, data: { id: message } });
  }
});
// One client for the app, so route loaders can prefetch into the same cache components read.
export const queryClient: ReturnType<typeof createQueryClient> =
  createQueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 60 * 1000 }
    }
  });
export const QUERY_KEYS = {
  health: generateQueryKey('health', 'detail')
} as const;
