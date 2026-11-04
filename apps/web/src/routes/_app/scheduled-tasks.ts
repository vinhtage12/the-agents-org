import { createFileRoute } from '@tanstack/react-router';

import { ScheduledTasksPage } from '#modules/scheduled-tasks';
export const Route = createFileRoute('/_app/scheduled-tasks')({
  component: ScheduledTasksPage
});
