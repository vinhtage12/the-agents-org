import type { ISendRequestParams } from '@truyenmoinhu/query';
export interface IProjectRepoValues {
  name: string;
  path: string;
}
export interface IProjectRepo extends IProjectRepoValues {
  id: number;
  projectId: number;
}
export interface IProjectDefaults<TValue = string | null> {
  specAgent: TValue;
  devAgent: TValue;
  testAgent: TValue;
}
export interface IProjectSettings extends IProjectDefaults {
  repos: IProjectRepo[];
  defaultRepoId: number | null;
}
export interface IProjectDefaultsValues extends IProjectDefaults<string> {
  defaultRepoId: string;
}
export interface IAgentProfile {
  slug: string;
  name: string;
  provider: string;
  model?: string;
  effort?: string;
  skills: string[];
  instructions: string;
}
export interface IAgentProfileList {
  profiles: IAgentProfile[];
  errors: { file: string; message: string }[];
}
export interface IProjectSettingsProps {
  workspaceId: number;
  projectId: number;
}
export interface IProjectMutationVariables<TData = unknown>
  extends Pick<ISendRequestParams, 'url' | 'method'> {
  data?: TData;
}
