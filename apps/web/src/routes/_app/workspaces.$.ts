import { createFileRoute } from '@tanstack/react-router';

import { WorkspacePage } from '#modules/workspaces';
export const Route = createFileRoute('/_app/workspaces/$')({
  component: WorkspacePage
});
