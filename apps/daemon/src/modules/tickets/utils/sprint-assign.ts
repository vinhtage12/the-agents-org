import { ConflictException } from '@nestjs/common';

import type {
  SpecSource,
  SprintSource,
  SprintState,
  TicketSource
} from '#/generated/prisma/client';

// sprint = null means moving the ticket to the Backlog.
export function assertSprintAssignable(
  ticket: { source: TicketSource; sprintSource: SprintSource | null },
  sprint: {
    source: SprintSource;
    state: SprintState;
    visibleInProject: boolean;
  } | null,
  projectSpecSource: SpecSource
): void {
  if (ticket.source === 'JIRA' && ticket.sprintSource === 'JIRA')
    throw new ConflictException('Sprint follows Jira');
  if (!sprint) return;
  if (sprint.state === 'CLOSED')
    throw new ConflictException('Sprint is closed');
  if (!sprint.visibleInProject)
    throw new ConflictException('Sprint is not available in this project');
  if (
    sprint.source === 'JIRA' &&
    (ticket.source !== 'LOCAL' || projectSpecSource !== 'HYBRID')
  )
    throw new ConflictException(
      'Jira sprints only apply to local tickets in Hybrid projects'
    );
}
