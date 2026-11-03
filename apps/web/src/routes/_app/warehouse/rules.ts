import { createFileRoute } from '@tanstack/react-router';

import { RulePage } from '#modules/warehouse';
export const Route = createFileRoute('/_app/warehouse/rules')({
  component: RulePage
});
