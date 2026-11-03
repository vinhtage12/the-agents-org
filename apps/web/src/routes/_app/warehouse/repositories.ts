import { createFileRoute } from '@tanstack/react-router';

import withCard from '#hocs/withCard.tsx';
import { RepositoryPage } from '#modules/warehouse';

export const Route = createFileRoute('/_app/warehouse/repositories')({
  component: withCard()(RepositoryPage)
});
