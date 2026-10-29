import { createRootRoute } from '@tanstack/react-router';

import NotFound from '#components/NotFound';
import RootComponent from '#components/RootComponent';
export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound
});
