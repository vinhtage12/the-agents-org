import { createFileRoute } from '@tanstack/react-router';

import { Dashboard } from '#modules/dashboard';
export const Route = createFileRoute('/_app/')({ component: Dashboard });
