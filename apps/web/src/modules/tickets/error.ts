export class TicketError extends Error {
  constructor(readonly status?: number) {
    super('Ticket request failed');
  }
}
