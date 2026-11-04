import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { ConflictException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';
import { AgentProfilesService } from '#modules/agent-profiles/services/agent-profiles.service';
import { HerdrService } from '#modules/herdr/services/herdr.service';
import { assertRepoPath } from '#modules/repositories/utils/repo-path';

import { ScheduledRunnerService } from './scheduled-runner.service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn()
}));
jest.mock('#modules/repositories/utils/repo-path', () => ({
  assertRepoPath: jest.fn().mockResolvedValue(undefined)
}));

const run = {
  id: 5,
  taskId: 1,
  scheduledFor: new Date(2026, 10, 2, 8, 30),
  trigger: 'MANUAL' as const,
  status: 'RUNNING' as const,
  rerunOfId: null,
  dismissedAt: null,
  agentId: 2,
  agentName: 'Agent',
  paneId: 'pane-5',
  token: 'valid',
  outputPath: '/out/2026-11-02-eod.md',
  output: null,
  error: null,
  startedAt: new Date(2026, 10, 2, 8, 30),
  finishedAt: null,
  createdAt: new Date()
};
const task = {
  id: 1,
  name: 'EOD',
  slug: 'eod',
  prompt: 'Report',
  enabled: true,
  time: 510,
  days: [1],
  agentId: 2,
  outputDir: '/out',
  checkedUntil: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  agent: { id: 2, name: 'Agent' },
  repos: [{ position: 0, repo: { id: 3, name: 'repo', path: '/repo' } }]
};

describe('ScheduledRunnerService', () => {
  const prisma = {
    scheduledTask: { findUnique: jest.fn() },
    scheduledRun: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    }
  };
  const herdr = {
    createAgent: jest.fn(),
    sendPrompt: jest.fn(),
    closeAgent: jest.fn(),
    listAgents: jest.fn()
  };
  const profiles = { get: jest.fn() };
  const config = { get: jest.fn(key => (key === 'RUNS_DIR' ? '/runs' : 3005)) };
  const service = new ScheduledRunnerService(
    prisma as unknown as PrismaService,
    herdr as unknown as HerdrService,
    profiles as unknown as AgentProfilesService,
    config as never
  );
  const profile = {
    id: 2,
    name: 'Agent',
    provider: 'claude',
    path: '/agent',
    model: null,
    effort: null,
    allowedTools: [],
    rules: [],
    skills: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.scheduledTask.findUnique.mockResolvedValue(task);
    prisma.scheduledRun.create.mockResolvedValue(run);
    prisma.scheduledRun.update.mockImplementation(async ({ data }) => ({
      ...run,
      ...data
    }));
    prisma.scheduledRun.updateMany.mockResolvedValue({ count: 1 });
    profiles.get.mockResolvedValue(profile);
    (stat as jest.Mock).mockResolvedValue({ mtime: new Date(2026, 10, 2, 9) });
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (readFile as jest.Mock).mockResolvedValue('# output');
    herdr.createAgent.mockResolvedValue({ paneId: 'pane-5', ready: true });
    herdr.closeAgent.mockResolvedValue(undefined);
  });

  it('starts with all directories, primary repo cwd, and dated output path', async () => {
    await service.start(1, 'MANUAL', run.scheduledFor);
    expect(herdr.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo',
        args: expect.arrayContaining(['/runs', '/out'])
      })
    );
    expect(herdr.sendPrompt).toHaveBeenCalledWith(
      'pane-5',
      expect.stringContaining(join('/out', '2026-11-02-eod.md'))
    );
  });

  it('persists outputPath before launching the agent', async () => {
    await service.start(1, 'MANUAL', run.scheduledFor);
    const createCall = herdr.createAgent.mock.invocationCallOrder[0];
    const updates = prisma.scheduledRun.update.mock.invocationCallOrder;
    expect(updates.some(order => order < createCall)).toBe(true);
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outputPath: run.outputPath })
      })
    );
  });

  it('closes the pane and preserves stopped status if stopped while starting', async () => {
    prisma.scheduledRun.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.start(1, 'MANUAL', run.scheduledFor)
    ).rejects.toBeInstanceOf(ConflictException);
    expect(herdr.closeAgent).toHaveBeenCalledWith('pane-5');
    expect(prisma.scheduledRun.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' })
      })
    );
  });

  it('marks a not-ready agent failed and keeps its pane id', async () => {
    herdr.createAgent.mockResolvedValueOnce({
      paneId: 'blocked-pane',
      ready: false
    });
    await expect(service.start(1, 'MANUAL', run.scheduledFor)).rejects.toThrow(
      'waiting for input'
    );
    expect(prisma.scheduledRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          paneId: 'blocked-pane'
        })
      })
    );
  });

  it('marks sendPrompt failures and keeps the created pane id', async () => {
    herdr.sendPrompt.mockRejectedValueOnce(new Error('prompt failed'));
    await expect(service.start(1, 'MANUAL', run.scheduledFor)).rejects.toThrow(
      'prompt failed'
    );
    expect(prisma.scheduledRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', paneId: 'pane-5' })
      })
    );
  });

  it('marks a missing repo path failed without launching an agent', async () => {
    (assertRepoPath as jest.Mock).mockRejectedValueOnce(
      new Error('Repo path missing')
    );
    await expect(service.start(1, 'MANUAL', run.scheduledFor)).rejects.toThrow(
      'Repo path missing'
    );
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Repo path missing'
        })
      })
    );
    expect(herdr.createAgent).not.toHaveBeenCalled();
  });

  it('marks mkdir failures failed', async () => {
    (mkdir as jest.Mock).mockRejectedValueOnce(new Error('mkdir denied'));
    await expect(service.start(1, 'MANUAL', run.scheduledFor)).rejects.toThrow(
      'mkdir denied'
    );
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'mkdir denied'
        })
      })
    );
  });

  it('maps running index conflicts', async () => {
    prisma.scheduledRun.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'scheduled_runs_one_running_per_task' }
    });
    await expect(
      service.start(1, 'MANUAL', run.scheduledFor)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects bad callback tokens and non-running callbacks', async () => {
    prisma.scheduledRun.findUnique.mockResolvedValue(run);
    await expect(service.complete(5, 'bad')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    prisma.scheduledRun.findUnique.mockResolvedValue({
      ...run,
      status: 'FAILED'
    });
    await expect(service.complete(5, 'valid')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('fails callbacks for stale output files', async () => {
    (stat as jest.Mock).mockResolvedValue({ mtime: new Date(0) });
    prisma.scheduledRun.findUnique.mockResolvedValue(run);
    await expect(service.complete(5, 'valid')).rejects.toThrow(
      'output file missing'
    );
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'output file missing'
        })
      })
    );
  });

  it('completes fresh output and closes its pane', async () => {
    prisma.scheduledRun.findUnique.mockResolvedValue(run);
    await service.complete(5, 'valid');
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          output: '# output',
          finishedAt: expect.any(Date)
        })
      })
    );
    expect(herdr.closeAgent).toHaveBeenCalledWith('pane-5');
  });

  it('keeps completion successful when closing the pane fails', async () => {
    prisma.scheduledRun.findUnique.mockResolvedValue(run);
    herdr.closeAgent.mockRejectedValueOnce(new Error('close failed'));
    await expect(service.complete(5, 'valid')).resolves.toBeUndefined();
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' })
      })
    );
  });

  it('fails timed-out runs without closing panes', async () => {
    const now = new Date(2026, 10, 2, 9);
    await service.failTimedOut(now);
    expect(prisma.scheduledRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'RUNNING',
          startedAt: { lt: expect.any(Date) }
        }),
        data: { status: 'FAILED', error: 'timed out', finishedAt: now }
      })
    );
    expect(herdr.closeAgent).not.toHaveBeenCalled();
  });

  it('fails running runs whose pane is gone on initialization', async () => {
    prisma.scheduledRun.findMany.mockResolvedValue([run]);
    herdr.listAgents.mockResolvedValue([]);
    await service.onModuleInit();
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Agent pane is gone'
        })
      })
    );
  });

  it('reruns missed runs and failed reruns, while rejecting completed/already rerun runs', async () => {
    const missed = { ...run, status: 'MISSED', paneId: null, rerun: null };
    prisma.scheduledRun.findUnique.mockResolvedValue(missed);
    await service.rerun(5);
    expect(prisma.scheduledRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trigger: 'RERUN',
          rerunOfId: 5,
          scheduledFor: run.scheduledFor
        })
      })
    );
    prisma.scheduledRun.findUnique.mockResolvedValue({
      ...missed,
      status: 'COMPLETED'
    });
    await expect(service.rerun(5)).rejects.toBeInstanceOf(ConflictException);
    prisma.scheduledRun.findUnique.mockResolvedValue({ ...missed, rerun: run });
    await expect(service.rerun(5)).rejects.toBeInstanceOf(ConflictException);
    prisma.scheduledRun.findUnique.mockResolvedValue({
      ...run,
      status: 'FAILED',
      rerunOfId: 4,
      rerun: null
    });
    await service.rerun(5);
    expect(prisma.scheduledRun.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rerunOfId: 5 })
      })
    );
  });

  it('dismisses eligible runs and rejects other statuses', async () => {
    prisma.scheduledRun.findUnique.mockResolvedValue({
      ...run,
      status: 'FAILED'
    });
    await service.dismiss(5);
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dismissedAt: expect.any(Date) } })
    );
    prisma.scheduledRun.findUnique.mockResolvedValue(run);
    await expect(service.dismiss(5)).rejects.toBeInstanceOf(ConflictException);
  });

  it('queries only undismissed, not-yet-rerun attention runs in descending order', async () => {
    prisma.scheduledRun.findMany.mockResolvedValue([]);
    await service.attention();
    expect(prisma.scheduledRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['MISSED', 'FAILED'] },
          dismissedAt: null,
          rerun: { is: null }
        },
        orderBy: { scheduledFor: 'desc' }
      })
    );
  });

  it('stops the run and closes its pane', async () => {
    prisma.scheduledRun.findUnique.mockResolvedValue(run);
    await service.stop(5);
    expect(prisma.scheduledRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'STOPPED', finishedAt: expect.any(Date) }
      })
    );
    expect(herdr.closeAgent).toHaveBeenCalledWith('pane-5');
  });
});
