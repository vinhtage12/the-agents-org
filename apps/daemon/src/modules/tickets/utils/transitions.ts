import { ConflictException } from '@nestjs/common';

import type { TicketStatus } from '../entities/ticket.entity';

// Moves the owner may make by dragging; Plan 03 adds the Dev/Testing columns.
export const ALLOWED_MOVES: Partial<Record<TicketStatus, TicketStatus[]>> = {
  TODO: ['IN_SPEC']
};

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!ALLOWED_MOVES[from]?.includes(to))
    throw new ConflictException(`Cannot move ticket from ${from} to ${to}`);
}
