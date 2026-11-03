import { SprintState } from '../../../generated/prisma/client';
import { JiraSprint } from '../clients/jira.client';

const time = (date: Date | null) => date?.getTime() ?? Infinity;

export function pickSprint(sprints: JiraSprint[]): JiraSprint | null {
  const active = sprints.find(s => s.state === 'active');
  if (active) return active;
  const stamp = (s: JiraSprint) =>
    s.startDate ? Date.parse(s.startDate) : Infinity;
  return (
    sprints
      .filter(s => s.state === 'future')
      .sort((a, b) => stamp(a) - stamp(b) || a.id - b.id)[0] ?? null
  );
}

export function nextSprintId(
  current: { id: number; source: 'JIRA' | 'LOCAL' } | null,
  picked: number | null
): number | null | undefined {
  if (picked !== null) return picked;
  return current?.source === 'JIRA' ? null : undefined;
}

export function effectiveState(
  s: { state: SprintState; endDate: Date | null },
  now: Date
): SprintState {
  return s.state === 'ACTIVE' && s.endDate && s.endDate < now
    ? 'CLOSED'
    : s.state;
}

interface Candidate {
  id: number;
  state: SprintState;
  jiraBoardId: number | null;
  startDate: Date | null;
}

export function rolloverTarget(
  closed: { jiraBoardId: number | null },
  candidates: Candidate[],
  // Same-board steps look at every open sprint; the fallbacks only at `candidates`.
  openSprints: Candidate[] = candidates
): number | null {
  const sameBoard = openSprints.filter(
    c => c.jiraBoardId === closed.jiraBoardId
  );
  const earliest = (list: Candidate[]) =>
    list
      .filter(c => c.state === 'FUTURE')
      .sort((a, b) => time(a.startDate) - time(b.startDate) || a.id - b.id)[0];
  return (
    (
      sameBoard.find(c => c.state === 'ACTIVE') ??
      earliest(sameBoard) ??
      candidates.find(c => c.state === 'ACTIVE') ??
      earliest(candidates)
    )?.id ?? null
  );
}
