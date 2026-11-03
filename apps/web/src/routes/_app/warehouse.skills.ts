import { createFileRoute } from '@tanstack/react-router';

import { SkillPage } from '#modules/warehouse';
export const Route = createFileRoute('/_app/warehouse/skills')({
  component: SkillPage
});
