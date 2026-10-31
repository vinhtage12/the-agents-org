import { createFileRoute } from '@tanstack/react-router';

import { TicketStorePage } from '#modules/tickets';
export const Route = createFileRoute('/_app/tickets')({
  component: TicketStorePage
});
