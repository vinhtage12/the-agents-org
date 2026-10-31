import { createFileRoute } from '@tanstack/react-router';

import { ProjectPage } from '#modules/projects';
export const Route = createFileRoute(
  '/_app/workspaces/$workspaceId/projects/$'
)({
  component: ProjectPage
});
