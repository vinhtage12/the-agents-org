import { ConflictException } from '@nestjs/common';

import type { TicketStatus } from '../entities/ticket.entity';

// Moves the owner may make by dragging.
export const ALLOWED_MOVES: Partial<Record<TicketStatus, TicketStatus[]>> = {
  TODO: ['IN_SPEC'],
  IN_REVIEW_SPEC: ['IN_PROGRESS'],
  IN_TESTING: ['IN_REVIEW'],
  IN_REVIEW: ['DONE']
};

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!ALLOWED_MOVES[from]?.includes(to))
    throw new ConflictException(`Cannot move ticket from ${from} to ${to}`);
}
