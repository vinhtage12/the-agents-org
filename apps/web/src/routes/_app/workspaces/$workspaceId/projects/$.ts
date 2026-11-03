import { createFileRoute } from '@tanstack/react-router';

import { ProjectPage } from '#modules/projects';
export const Route = createFileRoute(
  '/_app/workspaces/$workspaceId/projects/$'
)({
  // ?ticket=<id> opens that ticket's dialog (links from the warehouse usage panel).
  // ?sprint=<id>|all keeps the board's sprint filter; absent means the running sprints.
  validateSearch: (
    search: Record<string, unknown>
  ): { ticket?: number; sprint?: string } => {
    const ticket = Number(search.ticket);
    const sprint = search.sprint ? String(search.sprint) : undefined;
    return {
      ...(Number.isInteger(ticket) && ticket > 0 ? { ticket } : {}),
      ...(sprint ? { sprint } : {})
    };
  },
  component: ProjectPage
});
