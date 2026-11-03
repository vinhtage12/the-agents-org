import type { ISendRequestParams } from '@truyenmoinhu/query';
export interface IEntityValues {
  name: string;
  code: string;
}
export interface IEntity<TId = number> extends IEntityValues {
  id: TId;
}

import type { SpecSource } from './enum';

export type TSpecSource = SpecSource;
export interface IProject extends IEntity {
  workspaceId: number;
  specSource: TSpecSource;
  specDir: string | null;
}
export interface IWorkspace<TProject extends IProject = IProject>
  extends IEntity {
  projects: TProject[];
}
export interface IEntityFormValues extends IEntityValues {
  workspaceId: string;
  specSource: TSpecSource;
  specDir: string;
}
export interface IWorkspaceMutationVariables<TData = unknown>
  extends Pick<ISendRequestParams, 'url' | 'method'> {
  data?: TData;
}

export interface IEntityFormContext {
  workspace?: IWorkspace;
  entity?: IWorkspace | IProject;
  projectMode?: boolean;
}
export interface IEntityWriteValues extends IEntityValues {
  workspaceId?: number;
  specSource?: TSpecSource;
  specDir?: string | null;
}
