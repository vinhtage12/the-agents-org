import type { ISendRequestParams } from '@truyenmoinhu/query';
import type { IAgentRef, IOption } from '#modules/warehouse';

export interface IProjectRepo {
  id: number;
  name: string;
  path: string;
}
export interface IProjectDefaults<TAgent> {
  specAgent: TAgent;
  devAgent: TAgent;
  testAgent: TAgent;
}
export interface IProjectSettings extends IProjectDefaults<IAgentRef | null> {
  repos: IProjectRepo[];
  defaultRepoId: number | null;
}
export interface IProjectDefaultsValues
  extends IProjectDefaults<IOption | null> {
  repos: IOption[];
  defaultRepoId: string;
}
export interface IProjectSettingsProps {
  workspaceId: number;
  projectId: number;
}
export interface IProjectMutationVariables<TData = unknown>
  extends Pick<ISendRequestParams, 'url' | 'method'> {
  data?: TData;
}
