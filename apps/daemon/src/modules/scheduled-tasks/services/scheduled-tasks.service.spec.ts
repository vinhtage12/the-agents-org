import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';
import { AgentProfilesService } from '#modules/agent-profiles/services/agent-profiles.service';

import { ScheduledTasksService } from './scheduled-tasks.service';

jest.mock('#modules/repositories/utils/repo-path', () => ({
  assertRepoPath: jest.fn().mockResolvedValue(undefined)
}));

const task = {
  id: 1,
  name: 'EOD',
  slug: 'eod',
  prompt: 'Report.',
  enabled: true,
  time: 510,
  days: [1],
  agentId: 2,
  outputDir: '/out',
  checkedUntil: new Date('2026-11-02T08:00:00'),
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('ScheduledTasksService', () => {
  const prisma = {
    scheduledTask: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    scheduledTaskRepo: { deleteMany: jest.fn(), createMany: jest.fn() },
    scheduledRun: { count: jest.fn() },
    repo: { findMany: jest.fn() },
    $transaction: jest.fn()
  };
  const profiles = { get: jest.fn() };
  const service = new ScheduledTasksService(
    prisma as unknown as PrismaService,
    profiles as unknown as AgentProfilesService
  );
  const dto = {
    name: 'Báo cáo EOD',
    time: 510,
    days: [1, 3, 5],
    agentId: 2,
    repoIds: [4, 3],
    outputDir: '~/Reports',
    prompt: 'Report.',
    enabled: true
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(fn => fn(prisma));
    profiles.get.mockResolvedValue({ id: 2 });
    prisma.repo.findMany.mockResolvedValue([
      { id: 4, path: '/repo/a' },
      { id: 3, path: '/repo/b' }
    ]);
  });

  it('creates a slugged task with expanded output, ordered repos, and checkedUntil now', async () => {
    prisma.scheduledTask.create.mockResolvedValue(task);
    const before = new Date();
    await service.create(dto);

    expect(prisma.scheduledTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Báo cáo EOD',
        slug: 'bao-cao-eod',
        outputDir: expect.stringMatching(/Reports$/),
        checkedUntil: expect.any(Date),
        repos: {
          create: [
            { repoId: 4, position: 0 },
            { repoId: 3, position: 1 }
          ]
        }
      })
    });
    expect(
      prisma.scheduledTask.create.mock.calls[0][0].data.checkedUntil.getTime()
    ).toBeGreaterThanOrEqual(before.getTime());
  });

  it('maps duplicate task names or slugs to a conflict', async () => {
    prisma.scheduledTask.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create(dto)).rejects.toEqual(
      new ConflictException('A task with this name already exists')
    );
  });

  it('rejects relative output directories without writing', async () => {
    await expect(
      service.create({ ...dto, outputDir: 'reports' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduledTask.create).not.toHaveBeenCalled();
  });

  it('uses the agent profile not-found error and rejects missing repos', async () => {
    profiles.get.mockRejectedValue(new NotFoundException('Agent not found'));
    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);

    profiles.get.mockResolvedValue({ id: 2 });
    prisma.repo.findMany.mockResolvedValue([{ id: 4, path: '/repo/a' }]);
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('resets checkedUntil only when the schedule changes or is re-enabled', async () => {
    prisma.scheduledTask.findUnique.mockResolvedValue(task);
    prisma.scheduledTask.update.mockResolvedValue(task);

    await service.update(1, { prompt: 'Only text.' });
    expect(prisma.scheduledTask.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { prompt: 'Only text.' }
    });

    await service.update(1, { time: 600 });
    expect(prisma.scheduledTask.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { time: 600, checkedUntil: expect.any(Date) }
    });

    prisma.scheduledTask.findUnique.mockResolvedValue({
      ...task,
      enabled: false
    });
    await service.update(1, { enabled: true });
    expect(prisma.scheduledTask.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { enabled: true, checkedUntil: expect.any(Date) }
    });
  });

  it('does not reset checkedUntil when schedule days are reordered', async () => {
    prisma.scheduledTask.findUnique.mockResolvedValue({
      ...task,
      days: [1, 3]
    });
    prisma.scheduledTask.update.mockResolvedValue(task);
    await service.update(1, { days: [3, 1] });
    expect(prisma.scheduledTask.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { days: [3, 1] }
    });
  });

  it('maps update uniqueness errors to a conflict', async () => {
    prisma.scheduledTask.findUnique.mockResolvedValue(task);
    prisma.scheduledTask.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.update(1, { name: 'Duplicate' })).rejects.toEqual(
      new ConflictException('A task with this name already exists')
    );
  });

  it('replaces task repos in a transaction', async () => {
    prisma.scheduledTask.findUnique.mockResolvedValue(task);
    prisma.scheduledTask.update.mockResolvedValue(task);
    await service.update(1, { repoIds: [3, 4] });

    expect(prisma.scheduledTaskRepo.deleteMany).toHaveBeenCalledWith({
      where: { taskId: 1 }
    });
    expect(prisma.scheduledTaskRepo.createMany).toHaveBeenCalledWith({
      data: [
        { taskId: 1, repoId: 3, position: 0 },
        { taskId: 1, repoId: 4, position: 1 }
      ]
    });
  });

  it('does not remove a task with a running run', async () => {
    prisma.scheduledTask.findUnique.mockResolvedValue(task);
    prisma.scheduledRun.count.mockResolvedValue(1);

    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.scheduledTask.delete).not.toHaveBeenCalled();
  });

  it('removes a task when it has no running run', async () => {
    prisma.scheduledTask.findUnique.mockResolvedValue(task);
    prisma.scheduledRun.count.mockResolvedValue(0);
    await service.remove(1);
    expect(prisma.scheduledTask.delete).toHaveBeenCalledWith({
      where: { id: 1 }
    });
  });

  it('adds the next run to enabled tasks and null to disabled tasks', async () => {
    prisma.scheduledTask.findMany.mockResolvedValue([
      {
        ...task,
        repos: [{ position: 0, repo: { id: 3, name: 'B', path: '/repo/b' } }],
        agent: { id: 2, name: 'Agent' },
        runs: []
      },
      {
        ...task,
        id: 2,
        enabled: false,
        repos: [],
        agent: { id: 2, name: 'Agent' },
        runs: []
      }
    ]);

    const views = await service.list();
    expect(views[0].nextRunAt).toBeInstanceOf(Date);
    expect(views[1].nextRunAt).toBeNull();
  });
});
