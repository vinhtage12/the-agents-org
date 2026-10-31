import { WORKSPACE_ENDPOINTS } from './constants';
import { WorkspaceError } from './error';

import type { ApiManager } from '@truyenmoinhu/query';
import type { IEntityFormContext, IWorkspaceMutationVariables } from './types';
export const write = async <TResponse, TData = unknown>(
  apiManager: ApiManager | null,
  variables: IWorkspaceMutationVariables<TData>
) => {
  if (!apiManager) {
    throw new WorkspaceError();
  }
  const result = await apiManager.sendRequest<TResponse>({
    ...variables,
    suppressNotifyOnError: true
  });
  if (!result.success) {
    throw new WorkspaceError(result.code);
  }
  return result.payload;
};

export const getEntityFormTitle = ({
  entity,
  projectMode
}: IEntityFormContext) => {
  if (entity) {
    return projectMode ? 'workspace.edit_project' : 'workspace.edit';
  }
  return projectMode ? 'workspace.create_project' : 'workspace.create';
};

export const getEntityPath = ({
  entity,
  projectMode,
  workspace
}: IEntityFormContext) => {
  if (!entity) {
    return projectMode ? String(workspace?.id) : '';
  }
  if (projectMode) {
    return `${workspace?.id}/projects/${entity.id}`;
  }
  return String(entity.id);
};

export const getEntityEndpoint = (context: IEntityFormContext) => {
  if (context.projectMode) {
    const path = context.entity ? `/${context.entity.id}` : '';
    return WORKSPACE_ENDPOINTS.base(`${context.workspace?.id}/projects${path}`);
  }
  return WORKSPACE_ENDPOINTS.base(
    context.entity ? String(context.entity.id) : undefined
  );
};
export const getWorkspaceRoute = (path: string) => {
  const [workspaceId, section, ...rest] = path.split('/');
  return section === 'projects'
    ? {
        to: '/workspaces/$workspaceId/projects/$' as const,
        params: { workspaceId, _splat: rest.join('/') }
      }
    : { to: '/workspaces/$' as const, params: { _splat: path } };
};
