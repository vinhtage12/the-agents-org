import { STARTUP_GRACE_MS } from '../../agent-runs/utils/constants';

import type { AgentRunStatus } from '../../agent-runs/entities/agent-run.entity';
import type { TicketStatus } from '../entities/ticket.entity';

export type BoardLabel = 'running' | 'approved' | 'needs_you' | null;

export function boardLabel(input: {
  status: TicketStatus;
  specApprovedAt: Date | null;
  run: {
    status: AgentRunStatus;
    paneId: string | null;
    startedAt: Date;
  } | null;
  paneStatus: string | undefined;
  now: Date;
}): BoardLabel {
  const { run } = input;
  if (run?.status === 'RUNNING') {
    if (input.paneStatus === 'working') return 'running';
    if (input.paneStatus === 'blocked') return 'needs_you';
    if (input.now.getTime() - run.startedAt.getTime() < STARTUP_GRACE_MS)
      return 'running';
    // Idle or blocked without a completion callback: the agent is waiting for the owner.
    return 'needs_you';
  }
  if (run?.status === 'FAILED' && input.status === 'IN_SPEC')
    return 'needs_you';
  if (input.status === 'IN_REVIEW_SPEC' && input.specApprovedAt)
    return 'approved';
  return null;
}
