import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';
export const PROJECT_QUERY_KEYS = {
  settings: generateQueryKey('project-settings'),
  agentProfiles: generateQueryKey('agent-profiles')
};
export const PROJECT_ENDPOINTS = {
  workspaces: withGenerateEndpoint('workspaces'),
  agentProfiles: withGenerateEndpoint('agent-profiles')
};
export const AGENT_ROLES = ['specAgent', 'devAgent', 'testAgent'] as const;
