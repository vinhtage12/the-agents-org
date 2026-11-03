import type { ISendRequestParams } from '@truyenmoinhu/query';
import type { WAREHOUSE_KINDS } from './constants';

export type WarehouseKind = keyof typeof WAREHOUSE_KINDS;
export type AgentRole = 'BA' | 'DEV' | 'QC' | 'FILE_PROCESSOR';
export type BranchKind = 'CHECKOUT_BASE' | 'PR_TARGET' | 'NONE';

export interface IAgentRef {
  id: number;
  name: string;
  role: AgentRole;
  provider: string;
  model: string | null;
}

export interface IUsage {
  projects: { id: number; name: string; code: string; workspaceId: number }[];
  tickets: {
    id: number;
    jiraKey: string;
    projectId: number | null;
    workspaceId: number | null;
  }[];
  agents: { id: number; name: string }[];
}
export interface IWarehouseRow {
  id: number;
  inUse: number;
}
export interface IWarehouseListResponse<TRow> {
  data: TRow[];
}

export interface IRepo {
  id: number;
  name: string;
  path: string;
  description: string;
  updatedAt: string;
}
export interface IRepoListItem extends IRepo, IWarehouseRow {
  environments: string[];
}
export interface IBranchInput {
  name: string;
  kind: BranchKind;
}
export interface IRepoBranch extends IBranchInput {
  id: number;
}
export interface IRepoEnvironmentValues {
  name: string;
  envFile: string;
  branches: IBranchInput[];
}
export interface IRepoEnvironment {
  id: number;
  repoId: number;
  name: string;
  envFile: string;
  branches: IRepoBranch[];
}
export interface IRepoDetail extends IRepo {
  environments: IRepoEnvironment[];
}
export interface IRepoValues {
  name: string;
  path: string;
  description: string;
}

export interface ISkillValues {
  name: string;
  provider: string;
  command: string;
  path: string;
  description: string;
}
export interface ISkill extends ISkillValues, IWarehouseRow {}

export interface IRuleValues {
  name: string;
  path: string;
  description: string;
}
export interface IRule extends IRuleValues, IWarehouseRow {}

export interface IAgentValues {
  name: string;
  role: AgentRole;
  provider: string;
  model: string;
  effort: string;
  path: string;
  description: string;
  allowedTools: string;
  skills: IOption[];
  rules: IOption[];
}
// Autocomplete value: chosen options carry the API row, so `name` may replace `label`.
export interface IOption {
  id: number;
  label?: string;
  name?: string;
  provider?: string;
}
export interface IAgentListItem extends IWarehouseRow {
  name: string;
  role: AgentRole;
  provider: string;
  model: string | null;
  effort: string | null;
  path: string;
  description: string;
  allowedTools: string[];
  skills: { id: number; name: string; provider: string }[];
  rules: { id: number; name: string }[];
}

export interface IAgentDetail {
  id: number;
  name: string;
  role: AgentRole;
  provider: string;
  model: string | null;
  effort: string | null;
  path: string;
  description: string;
  allowedTools: string[];
  skills: { id: number; name: string; provider: string }[];
  rules: { id: number; name: string }[];
}

export interface IWarehouseMutationVariables<TData = unknown>
  extends Pick<ISendRequestParams, 'method'> {
  kind: WarehouseKind;
  path?: string;
  data?: TData;
}
