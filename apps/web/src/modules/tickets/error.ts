export class TicketError extends Error {
  constructor(
    readonly status?: number,
    message?: string
  ) {
    super(message || 'Ticket request failed');
  }
}
