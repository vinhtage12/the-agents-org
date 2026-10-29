import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';
export const WORKSPACE_QUERY_KEYS = {
  base: generateQueryKey('workspace')
};
export const WORKSPACE_ENDPOINTS = {
  base: withGenerateEndpoint('workspaces')
};
