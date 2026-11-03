import { createFileRoute } from '@tanstack/react-router';

import withCard from '#hocs/withCard.tsx';
import { TicketStorePage } from '#modules/tickets';

export const Route = createFileRoute('/_app/warehouse/tickets')({
  component: withCard()(TicketStorePage)
});
