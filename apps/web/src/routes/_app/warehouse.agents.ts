import { createFileRoute } from '@tanstack/react-router';

import { AgentPage } from '#modules/warehouse';
export const Route = createFileRoute('/_app/warehouse/agents')({
  component: AgentPage
});
