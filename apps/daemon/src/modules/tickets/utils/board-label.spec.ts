import { boardLabel } from './board-label';

describe('boardLabel', () => {
  const now = new Date('2026-10-31T10:00:00Z');
  const run = {
    status: 'RUNNING',
    paneId: 'w1:p9',
    startedAt: new Date('2026-10-31T09:59:00Z')
  } as const;
  const base = { status: 'IN_SPEC', specApprovedAt: null, now } as const;

  it('labels idle running agents as needs_you', () => {
    expect(boardLabel({ ...base, run, paneStatus: 'working' })).toBe('running');
    expect(boardLabel({ ...base, run, paneStatus: 'idle' })).toBe('needs_you');
    expect(boardLabel({ ...base, run, paneStatus: 'blocked' })).toBe(
      'needs_you'
    );
    expect(boardLabel({ ...base, run, paneStatus: undefined })).toBe(
      'needs_you'
    );
  });

  it('treats a just-started run as running', () => {
    expect(
      boardLabel({
        ...base,
        run: { ...run, startedAt: new Date('2026-10-31T09:59:50Z') },
        paneStatus: 'idle'
      })
    ).toBe('running');
  });

  it('shows a blocked agent as needs_you even during startup', () => {
    expect(
      boardLabel({
        ...base,
        run: { ...run, startedAt: new Date('2026-10-31T09:59:55Z') },
        paneStatus: 'blocked'
      })
    ).toBe('needs_you');
  });

  it('flags failed spec runs and approved specs', () => {
    expect(
      boardLabel({
        ...base,
        run: { ...run, status: 'FAILED' },
        paneStatus: undefined
      })
    ).toBe('needs_you');
    expect(
      boardLabel({
        status: 'TODO',
        specApprovedAt: null,
        run: { ...run, status: 'FAILED' },
        paneStatus: undefined,
        now
      })
    ).toBeNull();
    expect(
      boardLabel({
        status: 'IN_REVIEW_SPEC',
        specApprovedAt: now,
        run: null,
        paneStatus: undefined,
        now
      })
    ).toBe('approved');
    expect(
      boardLabel({
        status: 'IN_REVIEW_SPEC',
        specApprovedAt: null,
        run: { ...run, status: 'COMPLETED' },
        paneStatus: 'idle',
        now
      })
    ).toBeNull();
  });
});
