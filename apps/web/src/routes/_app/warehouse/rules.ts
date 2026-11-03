import { createFileRoute } from '@tanstack/react-router';

import withCard from '#hocs/withCard.tsx';
import { RulePage } from '#modules/warehouse';

export const Route = createFileRoute('/_app/warehouse/rules')({
  component: withCard()(RulePage)
});
