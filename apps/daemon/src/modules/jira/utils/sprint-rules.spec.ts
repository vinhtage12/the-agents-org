import { JiraSprint } from '../clients/jira.client';
import {
  effectiveState,
  nextSprintId,
  pickSprint,
  rolloverTarget
} from './sprint-rules';

const sprint = (
  id: number,
  state: JiraSprint['state'],
  startDate: string | null = null
): JiraSprint => ({
  id,
  name: `S${id}`,
  state,
  startDate,
  endDate: null,
  boardId: null
});

describe('pickSprint', () => {
  it('prefers active over future and closed', () => {
    const all = [
      sprint(1, 'closed'),
      sprint(2, 'future', '2026-01-01'),
      sprint(3, 'active')
    ];
    expect(pickSprint(all)?.id).toBe(3);
  });
  it('falls back to the earliest future sprint', () => {
    const all = [
      sprint(1, 'closed'),
      sprint(5, 'future', '2026-03-01'),
      sprint(4, 'future', '2026-02-01')
    ];
    expect(pickSprint(all)?.id).toBe(4);
  });
  it('orders future sprints without dates by smallest id', () => {
    expect(pickSprint([sprint(9, 'future'), sprint(8, 'future')])?.id).toBe(8);
  });
  it('returns null when only closed sprints exist', () => {
    expect(pickSprint([sprint(1, 'closed')])).toBeNull();
    expect(pickSprint([])).toBeNull();
  });
});

describe('nextSprintId', () => {
  it('uses the picked sprint', () => {
    expect(nextSprintId({ id: 1, source: 'LOCAL' }, 7)).toBe(7);
    expect(nextSprintId(null, 7)).toBe(7);
  });
  it('clears a JIRA sprint when nothing is picked', () => {
    expect(nextSprintId({ id: 1, source: 'JIRA' }, null)).toBeNull();
  });
  it('keeps a LOCAL sprint or no sprint when nothing is picked', () => {
    expect(nextSprintId({ id: 1, source: 'LOCAL' }, null)).toBeUndefined();
    expect(nextSprintId(null, null)).toBeUndefined();
  });
});

describe('effectiveState', () => {
  const now = new Date('2026-06-01');
  it('closes an active sprint past its end date', () => {
    expect(
      effectiveState({ state: 'ACTIVE', endDate: new Date('2026-05-01') }, now)
    ).toBe('CLOSED');
  });
  it('keeps everything else', () => {
    expect(
      effectiveState({ state: 'ACTIVE', endDate: new Date('2026-07-01') }, now)
    ).toBe('ACTIVE');
    expect(effectiveState({ state: 'ACTIVE', endDate: null }, now)).toBe(
      'ACTIVE'
    );
    expect(
      effectiveState({ state: 'FUTURE', endDate: new Date('2026-05-01') }, now)
    ).toBe('FUTURE');
  });
});

describe('rolloverTarget', () => {
  const c = (
    id: number,
    state: 'FUTURE' | 'ACTIVE',
    jiraBoardId: number | null,
    startDate: string | null = null
  ) => ({
    id,
    state,
    jiraBoardId,
    startDate: startDate ? new Date(startDate) : null
  });
  const closed = { jiraBoardId: 1 };
  it('prefers active on the same board', () => {
    const all = [c(1, 'ACTIVE', 2), c(2, 'FUTURE', 1), c(3, 'ACTIVE', 1)];
    expect(rolloverTarget(closed, all)).toBe(3);
  });
  it('then earliest future on the same board', () => {
    const all = [
      c(1, 'ACTIVE', 2),
      c(2, 'FUTURE', 1, '2026-03-01'),
      c(3, 'FUTURE', 1, '2026-02-01')
    ];
    expect(rolloverTarget(closed, all)).toBe(3);
  });
  it('then any active, then earliest future on any board', () => {
    expect(rolloverTarget(closed, [c(1, 'FUTURE', 2), c(2, 'ACTIVE', 3)])).toBe(
      2
    );
    expect(
      rolloverTarget(closed, [
        c(1, 'FUTURE', 2, '2026-03-01'),
        c(2, 'FUTURE', 3, '2026-02-01')
      ])
    ).toBe(2);
  });
  it('returns null without candidates', () => {
    expect(rolloverTarget(closed, [])).toBeNull();
  });
});
