import { PROJECT_ENDPOINTS } from './constants';

export const settingsPath = (
  workspaceId: number,
  projectId: number,
  path = 'settings'
) =>
  PROJECT_ENDPOINTS.workspaces(`${workspaceId}/projects/${projectId}/${path}`);
