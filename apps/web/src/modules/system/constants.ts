import { Bot, Code, Sparkles, Terminal } from 'lucide-react';

import { generateQueryKey } from '@truyenmoinhu/query';

import { withGenerateEndpoint } from '#utils/query';
export const SYSTEM_PROVIDERS = [
  { id: 'codex', icon: Terminal },
  { id: 'claude', icon: Sparkles },
  { id: 'copilot', icon: Code },
  { id: 'antigravity', icon: Bot }
];

export const SYSTEM_QUERY_KEYS = {
  docker: generateQueryKey('docker'),
  usage: generateQueryKey('agent-usage')
};
export const SYSTEM_ENDPOINTS = {
  docker: withGenerateEndpoint('system/docker'),
  usage: withGenerateEndpoint('system/agent-usage')
};
