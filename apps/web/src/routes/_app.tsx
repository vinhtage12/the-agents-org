import { createFileRoute } from '@tanstack/react-router';

import Layout from '#layouts';

export const Route = createFileRoute('/_app')({ component: Layout });
