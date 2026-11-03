import { createFileRoute } from '@tanstack/react-router';

import { ProjectPage } from '#modules/projects';
export const Route = createFileRoute(
  '/_app/workspaces/$workspaceId/projects/$'
)({
  // ?ticket=<id> opens that ticket's dialog (links from the warehouse usage panel).
  validateSearch: (search: Record<string, unknown>): { ticket?: number } => {
    const ticket = Number(search.ticket);
    return Number.isInteger(ticket) && ticket > 0 ? { ticket } : {};
  },
  component: ProjectPage
});
