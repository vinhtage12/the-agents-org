import { boardLabel } from './board-label';

describe('boardLabel', () => {
  const now = new Date('2026-10-31T10:00:00Z');
  const run = {
    status: 'RUNNING',
    paneId: 'w1:p9',
    startedAt: new Date('2026-10-31T09:59:00Z')
  } as const;
  const base = {
    status: 'IN_SPEC',
    specApprovedAt: null,
    now,
    lastRun: null,
    running: [] as { paneId: string | null; startedAt: Date }[],
    paneStatuses: new Map<string, string>()
  } as const;

  it('labels idle running agents as needs_you', () => {
    expect(
      boardLabel({
        ...base,
        running: [run],
        paneStatuses: new Map([[run.paneId, 'working']])
      })
    ).toBe('running');
    expect(
      boardLabel({
        ...base,
        running: [run],
        paneStatuses: new Map([[run.paneId, 'idle']])
      })
    ).toBe('needs_you');
    expect(
      boardLabel({
        ...base,
        running: [run],
        paneStatuses: new Map([[run.paneId, 'blocked']])
      })
    ).toBe('needs_you');
    expect(boardLabel({ ...base, running: [run] })).toBe('needs_you');
  });

  it('treats a just-started run as running', () => {
    expect(
      boardLabel({
        ...base,
        running: [{ ...run, startedAt: new Date('2026-10-31T09:59:50Z') }],
        paneStatuses: new Map([[run.paneId, 'idle']])
      })
    ).toBe('running');
  });

  it('shows a blocked agent as needs_you even during startup', () => {
    expect(
      boardLabel({
        ...base,
        running: [{ ...run, startedAt: new Date('2026-10-31T09:59:55Z') }],
        paneStatuses: new Map([[run.paneId, 'blocked']])
      })
    ).toBe('needs_you');
  });

  it('flags failed spec runs and approved specs', () => {
    expect(
      boardLabel({
        ...base,
        lastRun: { status: 'FAILED' }
      })
    ).toBe('needs_you');
    expect(
      boardLabel({
        ...base,
        status: 'TODO',
        specApprovedAt: null,
        lastRun: { status: 'FAILED' },
        now
      })
    ).toBeNull();
    expect(
      boardLabel({
        ...base,
        status: 'IN_REVIEW_SPEC',
        specApprovedAt: now,
        lastRun: null,
        now
      })
    ).toBe('approved');
    expect(
      boardLabel({
        ...base,
        status: 'IN_REVIEW_SPEC',
        specApprovedAt: null,
        lastRun: { status: 'COMPLETED' },
        now
      })
    ).toBeNull();
  });

  it('labels exhausted testing as needs_you', () => {
    expect(boardLabel({ ...base, status: 'IN_TESTING' })).toBe('needs_you');
  });
  it('prefers running over failed history when a step is running', () => {
    expect(
      boardLabel({
        ...base,
        status: 'IN_PROGRESS',
        lastRun: { status: 'FAILED' },
        running: [run],
        paneStatuses: new Map([[run.paneId, 'working']])
      })
    ).toBe('running');
  });
});
