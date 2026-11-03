import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_app/tickets')({
  beforeLoad: () => {
    throw redirect({ to: '/warehouse/tickets', replace: true });
  }
});
