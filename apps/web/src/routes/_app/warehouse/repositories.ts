import { createFileRoute } from '@tanstack/react-router';

import { RepositoryPage } from '#modules/warehouse';
export const Route = createFileRoute('/_app/warehouse/repositories')({
  component: RepositoryPage
});
