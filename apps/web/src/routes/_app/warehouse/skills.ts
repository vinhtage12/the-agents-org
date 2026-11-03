import { createFileRoute } from '@tanstack/react-router';

import withCard from '#hocs/withCard.tsx';
import { SkillPage } from '#modules/warehouse';

export const Route = createFileRoute('/_app/warehouse/skills')({
  component: withCard()(SkillPage)
});
