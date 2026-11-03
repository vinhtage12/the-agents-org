export {
  AgentRunStatus,
  AgentStep,
  SprintState,
  TestMode,
  TicketSource,
  TicketStatus
} from '#/generated/prisma/client';

export enum BoardLabel {
  RUNNING = 'running',
  APPROVED = 'approved',
  NEEDS_YOU = 'needs_you'
}
