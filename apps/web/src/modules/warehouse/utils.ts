import { BASE_API_URL, BASE_API_VERSION } from '#constants/env';

import { WAREHOUSE_KINDS } from './constants';

import type { IOption } from './types';

// <img> cannot go through apiManager, so build the URL from the same base.
export const agentAvatarUrl = (agentId: number) =>
  `${BASE_API_URL}/${BASE_API_VERSION}/${WAREHOUSE_KINDS.agents}/${agentId}/avatar`;

export const optionLabel = (option: IOption) =>
  option.label ?? option.name ?? String(option.id);

export const splitList = (value: string) =>
  value.split(/[\s,]+/).filter(Boolean);

export const agentLabel = (agent: { name: string; provider?: string }) =>
  agent.provider ? `${agent.name} (${agent.provider})` : agent.name;

export const skillLabel = (option: IOption) =>
  option.provider
    ? `${optionLabel(option)} (${option.provider})`
    : optionLabel(option);
