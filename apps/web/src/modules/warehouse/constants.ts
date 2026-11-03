import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';

import { AgentProvider, AgentRole, BranchKind } from './enum';

export const WAREHOUSE_QUERY_KEYS = {
  list: generateQueryKey('warehouse-list'),
  detail: generateQueryKey('warehouse-detail'),
  usage: generateQueryKey('warehouse-usage')
};

// Warehouse kind -> daemon route.
export const WAREHOUSE_KINDS = {
  repositories: 'repositories',
  agents: 'agent-profiles',
  skills: 'skills',
  rules: 'rules'
} as const;

export const WAREHOUSE_ENDPOINTS = {
  repositories: withGenerateEndpoint(WAREHOUSE_KINDS.repositories),
  agents: withGenerateEndpoint(WAREHOUSE_KINDS.agents),
  skills: withGenerateEndpoint(WAREHOUSE_KINDS.skills),
  rules: withGenerateEndpoint(WAREHOUSE_KINDS.rules)
};

export const WAREHOUSE_TABS = [
  { key: 'tickets', to: '/warehouse/tickets' },
  { key: 'repositories', to: '/warehouse/repositories' },
  { key: 'agents', to: '/warehouse/agents' },
  { key: 'skills', to: '/warehouse/skills' },
  { key: 'rules', to: '/warehouse/rules' }
] as const;

export const WAREHOUSE_DIALOG = 'warehouse-dialog';
export const PROVIDERS = Object.values(AgentProvider);
export const AGENT_ROLES = Object.values(AgentRole);
export const BRANCH_KINDS = [
  BranchKind.NONE,
  BranchKind.CHECKOUT_BASE,
  BranchKind.PR_TARGET
];
export const AVATAR_SIZE = { sm: '1', md: '2', lg: '3' } as const;
export const AGENT_DIALOG = 'warehouse-agent-dialog';
