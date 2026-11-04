import { ConflictException } from '@nestjs/common';

import { OPEN_TICKET } from '#constants/open-ticket';
import { PrismaService } from '#database/prisma.service';
import { GitService } from '#modules/git/services/git.service';

import { RepositoriesService } from './repositories.service';

describe('RepositoriesService', () => {
  const tx = {
    repoEnvironment: { update: jest.fn(), create: jest.fn() },
    repoBranch: { deleteMany: jest.fn(), createMany: jest.fn() }
  };
  const prisma = {
    repo: { findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    repoEnvironment: { findFirst: jest.fn() },
    project: { count: jest.fn() },
    ticket: { count: jest.fn() },
    scheduledTaskRepo: { count: jest.fn() },
    $transaction: jest.fn()
  };
  const git = { branches: jest.fn() };
  const service = new RepositoriesService(
    prisma as unknown as PrismaService,
    git as unknown as GitService
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(fn => fn(tx));
    prisma.repo.findUnique.mockResolvedValue({ id: 1, path: '/r' });
    prisma.scheduledTaskRepo.count.mockResolvedValue(0);
  });

  it('blocks delete when an open ticket or project uses the repo', async () => {
    prisma.project.count.mockResolvedValue(0);
    prisma.ticket.count.mockResolvedValue(1);
    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.repo.delete).not.toHaveBeenCalled();
  });

  it('remove rejects a repo used by a scheduled task', async () => {
    prisma.project.count.mockResolvedValue(0);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.scheduledTaskRepo.count.mockResolvedValue(1);

    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.repo.delete).not.toHaveBeenCalled();
  });

  it('includes scheduled tasks in the repo in-use count', async () => {
    prisma.repo.findMany.mockResolvedValue([
      {
        id: 1,
        environments: [],
        _count: { projects: 0, tickets: 0, scheduledTasks: 3 }
      }
    ]);
    expect(await service.list()).toMatchObject({ data: [{ inUse: 3 }] });
    expect(prisma.repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: expect.objectContaining({ scheduledTasks: true }) }
        })
      })
    );
  });

  it('ignores closed tickets when counting usage', async () => {
    prisma.project.count.mockResolvedValue(0);
    prisma.ticket.count.mockResolvedValue(0);
    await service.remove(1);
    expect(prisma.ticket.count).toHaveBeenCalledWith({
      where: { repoId: 1, ...OPEN_TICKET }
    });
    expect(prisma.repo.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('maps the second checkout base to 409', async () => {
    prisma.$transaction.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'repo_branches_one_checkout_base' }
    });
    await expect(
      service.createEnvironment(1, { name: 'e', envFile: '', branches: [] })
    ).rejects.toThrow('Only one checkout base branch per repo');
  });

  it('replaces branches on environment update in one transaction', async () => {
    prisma.repoEnvironment.findFirst.mockResolvedValue({ id: 5, repoId: 1 });
    await service.updateEnvironment(1, 5, {
      name: 'e',
      envFile: '.env',
      branches: [{ name: 'main', kind: 'CHECKOUT_BASE' }]
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.repoBranch.deleteMany).toHaveBeenCalledWith({
      where: { environmentId: 5 }
    });
    expect(tx.repoBranch.createMany).toHaveBeenCalledWith({
      data: [
        { environmentId: 5, repoId: 1, name: 'main', kind: 'CHECKOUT_BASE' }
      ]
    });
  });

  it('returns git branches with the checkout base', async () => {
    git.branches.mockResolvedValue(['main', 'develop', 'origin/develop']);
    prisma.repo.findUnique.mockResolvedValue({
      id: 1,
      path: '/r',
      environments: [{ branches: [{ name: 'develop', kind: 'CHECKOUT_BASE' }] }]
    });
    expect(await service.gitBranches(1, 'DEV')).toEqual({
      data: [{ label: 'develop' }, { label: 'origin/develop' }],
      base: 'develop'
    });
  });
});
