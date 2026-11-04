import { PrismaService } from '#database/prisma.service';

import { ScheduledRunTrigger } from '../enum';
import { ScheduledRunnerService } from './scheduled-runner.service';
import { SchedulerService } from './scheduler.service';

describe('SchedulerService', () => {
  const prisma = { scheduledTask: { findMany: jest.fn(), update: jest.fn() } };
  const runner = {
    start: jest.fn(),
    recordMissed: jest.fn(),
    recordSkipped: jest.fn(),
    hasRunning: jest.fn(),
    failTimedOut: jest.fn()
  };
  const service = new SchedulerService(
    prisma as unknown as PrismaService,
    runner as unknown as ScheduledRunnerService
  );
  const now = new Date(2026, 10, 12, 9);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.scheduledTask.findMany.mockResolvedValue([
      {
        id: 1,
        time: 540,
        days: [4],
        checkedUntil: new Date(2026, 10, 12, 8),
        enabled: true
      }
    ]);
    runner.hasRunning.mockResolvedValue(false);
    runner.start.mockResolvedValue(undefined);
  });

  it('starts a recent occurrence and advances checkedUntil', async () => {
    await service.tick(now);
    expect(runner.start).toHaveBeenCalledWith(
      1,
      ScheduledRunTrigger.SCHEDULE,
      new Date(2026, 10, 12, 9)
    );
    expect(prisma.scheduledTask.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { checkedUntil: now }
    });
  });

  it('records occurrences beyond grace as missed', async () => {
    prisma.scheduledTask.findMany.mockResolvedValue([
      {
        id: 1,
        time: 540,
        days: [4],
        checkedUntil: new Date(2026, 10, 12, 8),
        enabled: true
      }
    ]);
    await service.tick(new Date(2026, 10, 12, 9, 3));
    expect(runner.recordMissed).toHaveBeenCalledWith(
      1,
      new Date(2026, 10, 12, 9)
    );
  });

  it('limits missed occurrences to the most recent seven days', async () => {
    prisma.scheduledTask.findMany.mockResolvedValue([
      {
        id: 1,
        time: 540,
        days: [0, 1, 2, 3, 4, 5, 6],
        checkedUntil: new Date(2026, 10, 2),
        enabled: true
      }
    ]);
    await service.tick(new Date(2026, 10, 12, 9, 3));
    expect(runner.recordMissed).toHaveBeenCalledTimes(7);
  });

  it('records skipped when a prior run is running', async () => {
    runner.hasRunning.mockResolvedValue(true);
    await service.tick(now);
    expect(runner.recordSkipped).toHaveBeenCalledWith(
      1,
      new Date(2026, 10, 12, 9)
    );
    expect(runner.start).not.toHaveBeenCalled();
  });

  it('queries enabled tasks only', async () => {
    await service.tick(now);
    expect(prisma.scheduledTask.findMany).toHaveBeenCalledWith({
      where: { enabled: true }
    });
  });

  it('ignores start conflicts and advances checkedUntil', async () => {
    runner.start.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'scheduled_runs_one_per_occurrence' }
    });
    await expect(service.tick(now)).resolves.toBeUndefined();
    expect(prisma.scheduledTask.update).toHaveBeenCalled();
  });

  it('continues after recording a missed occurrence fails for one task', async () => {
    prisma.scheduledTask.findMany.mockResolvedValue([
      {
        id: 1,
        time: 540,
        days: [4],
        checkedUntil: new Date(2026, 10, 12, 8),
        enabled: true
      },
      {
        id: 2,
        time: 540,
        days: [4],
        checkedUntil: new Date(2026, 10, 12, 8),
        enabled: true
      }
    ]);
    runner.recordMissed.mockRejectedValueOnce(new Error('one failed'));
    await service.tick(new Date(2026, 10, 12, 9, 3));
    expect(runner.recordMissed).toHaveBeenCalledWith(
      1,
      new Date(2026, 10, 12, 9)
    );
    expect(runner.recordMissed).toHaveBeenCalledWith(
      2,
      new Date(2026, 10, 12, 9)
    );
    expect(prisma.scheduledTask.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { checkedUntil: new Date(2026, 10, 12, 9, 3) }
    });
  });

  it('resolves when failTimedOut rejects', async () => {
    runner.failTimedOut.mockRejectedValueOnce(
      new Error('timeout query failed')
    );
    await expect(service.tick(now)).resolves.toBeUndefined();
    expect(prisma.scheduledTask.findMany).not.toHaveBeenCalled();
  });

  it('resolves when loading enabled tasks rejects', async () => {
    prisma.scheduledTask.findMany.mockRejectedValueOnce(
      new Error('query failed')
    );
    await expect(service.tick(now)).resolves.toBeUndefined();
  });

  it('skips a tick while the previous tick is pending', async () => {
    let finish!: () => void;
    runner.failTimedOut.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finish = resolve;
      })
    );
    const first = service.tick(now);
    await service.tick(now);
    expect(runner.failTimedOut).toHaveBeenCalledTimes(1);
    finish();
    await first;
  });

  it('fails timed out runs before processing tasks', async () => {
    await service.tick(now);
    expect(runner.failTimedOut).toHaveBeenCalledWith(now);
  });
});
