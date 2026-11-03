import type { TicketStatus } from '../../generated/prisma/client';

/** Prisma `where` fragment for tickets that are not closed. */
export const OPEN_TICKET: { status: { notIn: TicketStatus[] } } = {
  status: { notIn: ['DONE', 'CANCELED'] }
};
