import { STARTUP_GRACE_MS } from '../../agent-runs/utils/constants';

import type { AgentRunStatus } from '../../agent-runs/entities/agent-run.entity';
import type { TicketStatus } from '../entities/ticket.entity';

export type BoardLabel = 'running' | 'approved' | 'needs_you' | null;

export function boardLabel(input: {
  status: TicketStatus;
  specApprovedAt: Date | null;
  running: { paneId: string | null; startedAt: Date }[];
  lastRun: { status: AgentRunStatus } | null;
  paneStatuses: Map<string, string>;
  now: Date;
}): BoardLabel {
  for (const run of input.running) {
    const status = run.paneId ? input.paneStatuses.get(run.paneId) : undefined;
    if (
      status === 'blocked' ||
      (input.now.getTime() - run.startedAt.getTime() >= STARTUP_GRACE_MS &&
        status !== 'working')
    )
      return 'needs_you';
  }
  if (input.running.length) return 'running';
  if (
    input.lastRun?.status === 'FAILED' &&
    ['IN_SPEC', 'IN_PROGRESS', 'IN_TESTING'].includes(input.status)
  )
    return 'needs_you';
  if (input.status === 'IN_TESTING') return 'needs_you';
  if (input.status === 'IN_REVIEW_SPEC' && input.specApprovedAt)
    return 'approved';
  return null;
}
