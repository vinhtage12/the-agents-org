import { createFileRoute } from '@tanstack/react-router';

import withCard from '#hocs/withCard.tsx';
import { AgentPage } from '#modules/warehouse';

export const Route = createFileRoute('/_app/warehouse/agents')({
  component: withCard()(AgentPage)
});
