import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';
export const PROJECT_QUERY_KEYS = {
  settings: generateQueryKey('project-settings')
};
export const PROJECT_ENDPOINTS = {
  workspaces: withGenerateEndpoint('workspaces')
};
// Form field -> agent role the daemon accepts for that step.
export const AGENT_FIELDS = [
  { field: 'specAgent', role: 'BA' },
  { field: 'devAgent', role: 'DEV' },
  { field: 'testAgent', role: 'QC' }
] as const;
