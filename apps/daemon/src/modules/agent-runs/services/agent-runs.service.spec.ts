import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';

import { STARTUP_GRACE_MS } from '../utils/constants';
import { AgentRunsService } from './agent-runs.service';

import type { PrismaService } from '../../../database/prisma.service';
import type { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import type { HerdrService } from '../../herdr/services/herdr.service';
import type { BoardGateway } from '../gateways/board.gateway';

describe('AgentRunsService', () => {
  const repoDir = tmpdir();
  let runsDir: string;
  const tx = {
    ticket: { findUnique: jest.fn(), update: jest.fn() },
    specVersion: { aggregate: jest.fn(), create: jest.fn() },
    agentRun: { update: jest.fn() }
  };
  const prisma = {
    ticket: { findUnique: jest.fn() },
    agentRun: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    $transaction: jest.fn()
  };
  const herdr = {
    createAgent: jest.fn(),
    sendPrompt: jest.fn(),
    listAgents: jest.fn(),
    closeAgent: jest.fn(),
    subscribeAgent: jest.fn()
  };
  const profiles = { get: jest.fn() };
  const board = { emitChanged: jest.fn() };
  let service: AgentRunsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    runsDir = await mkdtemp(join(tmpdir(), 'runs-'));
    service = new AgentRunsService(
      prisma as unknown as PrismaService,
      herdr as unknown as HerdrService,
      profiles as unknown as AgentProfilesService,
      board as unknown as BoardGateway,
      {
        get: (key: string) => ({ RUNS_DIR: runsDir, PORT: 3005 })[key]
      } as never
    );
    prisma.ticket.findUnique.mockResolvedValue({
      id: 10,
      projectId: 3,
      jiraKey: 'FMS-1',
      summary: 'Login',
      description: 'Users log in',
      jiraUrl: 'https://j/browse/FMS-1',
      extraInstructions: '',
      extraSkills: [],
      specAgent: 'analyst',
      repoId: 5,
      repo: { id: 5, path: repoDir }
    });
    profiles.get.mockResolvedValue({
      slug: 'analyst',
      name: 'Analyst',
      provider: 'claude',
      model: 'claude-opus-5-5',
      skills: [],
      instructions: 'Think hard.'
    });
    prisma.agentRun.count.mockResolvedValue(0);
    prisma.agentRun.findFirst.mockResolvedValue(null);
    prisma.agentRun.create.mockResolvedValue({ id: 1, token: 'tok' });
    prisma.agentRun.update.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data
    }));
    herdr.listAgents.mockResolvedValue([]);
    herdr.createAgent.mockResolvedValue({ paneId: 'w1:p9', ready: true });
    herdr.subscribeAgent.mockReturnValue(jest.fn());
    prisma.$transaction.mockImplementation(async callback => callback(tx));
  });

  it('creates a pane in the ticket repo with profile args', async () => {
    await service.startSpec(10);
    expect(herdr.createAgent).toHaveBeenCalledWith({
      agent: 'claude',
      cwd: repoDir,
      args: expect.arrayContaining(['--model', 'claude-opus-5-5', runsDir])
    });
    expect(herdr.sendPrompt).toHaveBeenCalledWith(
      'w1:p9',
      expect.stringContaining('/agent-runs/1/complete')
    );
    expect(herdr.sendPrompt).toHaveBeenCalledWith(
      'w1:p9',
      expect.stringContaining(join(runsDir, '1', 'output.md'))
    );
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paneId: 'w1:p9' })
      })
    );
    expect(herdr.subscribeAgent).toHaveBeenCalledWith(
      'w1:p9',
      expect.any(Function)
    );
  });

  it('stores the feedback on the run', async () => {
    await service.startSpec(10, { version: 1, content: '# S', feedback: 'F' });
    expect(prisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 10,
        step: 'SPEC',
        agentSlug: 'analyst',
        feedback: 'F'
      })
    });
  });

  it('reuses a live pane from a failed run', async () => {
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 3,
      paneId: 'w1:p4',
      agentSlug: 'analyst',
      status: 'FAILED'
    });
    herdr.listAgents.mockResolvedValue([
      { paneId: 'w1:p4', status: 'idle', cwd: repoDir }
    ]);
    await service.startSpec(10);
    expect(herdr.createAgent).not.toHaveBeenCalled();
    expect(herdr.sendPrompt).toHaveBeenCalledWith('w1:p4', expect.any(String));
  });

  it('opens a new pane and closes the old one when the agent changed', async () => {
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 3,
      paneId: 'w1:p4',
      agentSlug: 'old',
      status: 'COMPLETED'
    });
    herdr.listAgents.mockResolvedValue([
      { paneId: 'w1:p4', status: 'idle', cwd: repoDir }
    ]);
    await service.startSpec(10);
    expect(herdr.closeAgent).toHaveBeenCalledWith('w1:p4');
    expect(herdr.createAgent).toHaveBeenCalled();
    expect(herdr.sendPrompt).toHaveBeenCalledWith('w1:p9', expect.any(String));
  });

  it('opens a new pane when the ticket repo changed', async () => {
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 3,
      paneId: 'w1:p4',
      agentSlug: 'analyst',
      status: 'FAILED'
    });
    herdr.listAgents.mockResolvedValue([
      { paneId: 'w1:p4', status: 'idle', cwd: '/repos/ff-web' }
    ]);
    await service.startSpec(10);
    expect(herdr.closeAgent).toHaveBeenCalledWith('w1:p4');
    expect(herdr.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: repoDir })
    );
    expect(herdr.sendPrompt).toHaveBeenCalledWith('w1:p9', expect.any(String));
  });

  it('refreshes the board once the startup grace ends', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await service.startSpec(10);
      board.emitChanged.mockClear();
      jest.advanceTimersByTime(STARTUP_GRACE_MS + 1000);
      expect(board.emitChanged).toHaveBeenCalledWith(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stopSpec stops running spec runs', async () => {
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.stopSpec(10)).resolves.toBe(1);
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith({
      where: { ticketId: 10, step: 'SPEC', status: 'RUNNING' },
      data: { status: 'STOPPED', finishedAt: expect.any(Date) }
    });
  });

  it('reverts the ticket when the agent cannot start', async () => {
    herdr.createAgent.mockResolvedValue({
      paneId: 'w1:p9',
      ready: false,
      message: 'trust folder?'
    });
    await expect(service.startSpec(10)).rejects.toThrow('w1:p9');
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', paneId: 'w1:p9' })
      })
    );
    expect(herdr.closeAgent).not.toHaveBeenCalled();
    expect(herdr.sendPrompt).not.toHaveBeenCalled();
  });

  it('marks the run failed when Herdr throws', async () => {
    herdr.createAgent.mockRejectedValue(new Error('socket down'));
    await expect(service.startSpec(10)).rejects.toThrow('socket down');
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'socket down'
        })
      })
    );
  });

  it('blocks when the agent file is gone', async () => {
    profiles.get.mockRejectedValue(
      new NotFoundException('Unknown agent: analyst')
    );
    await expect(service.startSpec(10)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(herdr.createAgent).not.toHaveBeenCalled();
    expect(prisma.agentRun.create).not.toHaveBeenCalled();
  });

  it('blocks tickets without repo or spec agent, or with a run in progress', async () => {
    prisma.ticket.findUnique.mockResolvedValueOnce({
      id: 10,
      repoId: null,
      repo: null,
      specAgent: 'analyst'
    });
    await expect(service.startSpec(10)).rejects.toThrow('Ticket has no repo');
    prisma.ticket.findUnique.mockResolvedValueOnce({
      id: 10,
      repoId: 5,
      repo: { path: repoDir },
      specAgent: null
    });
    await expect(service.startSpec(10)).rejects.toThrow(
      'Ticket has no spec agent'
    );
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(service.startSpec(10)).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(herdr.createAgent).not.toHaveBeenCalled();
  });

  describe('complete', () => {
    const runs: Record<number, object> = {
      1: {
        id: 1,
        ticketId: 10,
        token: 'tok',
        status: 'RUNNING',
        feedback: 'F'
      },
      2: { id: 2, ticketId: 10, token: 'tok', status: 'COMPLETED' }
    };
    beforeEach(() => {
      prisma.agentRun.findUnique.mockImplementation(
        async ({ where }) => runs[where.id] ?? null
      );
      tx.ticket.findUnique.mockResolvedValue({
        id: 10,
        status: 'IN_SPEC',
        projectId: 3
      });
      tx.specVersion.aggregate.mockResolvedValue({ _max: { version: 1 } });
    });

    it('rejects bad callbacks', async () => {
      await expect(service.complete(9, 'tok')).rejects.toBeInstanceOf(
        NotFoundException
      );
      await expect(service.complete(1, 'wrong')).rejects.toBeInstanceOf(
        ForbiddenException
      );
      await expect(service.complete(1, 'tok')).rejects.toBeInstanceOf(
        BadRequestException
      );
      await mkdir(join(runsDir, '1'), { recursive: true });
      await writeFile(join(runsDir, '1', 'output.md'), '  \n');
      await expect(service.complete(1, 'tok')).rejects.toBeInstanceOf(
        BadRequestException
      );
      await expect(service.complete(2, 'tok')).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('stores a new spec version and moves the ticket to review', async () => {
      await mkdir(join(runsDir, '1'), { recursive: true });
      await writeFile(join(runsDir, '1', 'output.md'), '# Spec\n');
      await service.complete(1, 'tok');
      expect(tx.specVersion.create).toHaveBeenCalledWith({
        data: { ticketId: 10, version: 2, content: '# Spec', feedback: 'F' }
      });
      expect(tx.ticket.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'IN_REVIEW_SPEC', specApprovedAt: null }
      });
      expect(tx.agentRun.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'COMPLETED', finishedAt: expect.any(Date) }
      });
      expect(board.emitChanged).toHaveBeenCalledWith(3);
    });

    it('stops the run when the ticket left In Spec', async () => {
      await mkdir(join(runsDir, '1'), { recursive: true });
      await writeFile(join(runsDir, '1', 'output.md'), '# Spec');
      tx.ticket.findUnique.mockResolvedValue({
        id: 10,
        status: 'CANCELED',
        projectId: 3
      });
      await service.complete(1, 'tok');
      expect(tx.specVersion.create).not.toHaveBeenCalled();
      expect(tx.agentRun.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'STOPPED', finishedAt: expect.any(Date) }
      });
    });
  });

  it('liveStatuses is empty when Herdr is down', async () => {
    herdr.listAgents.mockRejectedValue(new Error('down'));
    await expect(service.liveStatuses()).resolves.toEqual(new Map());
    herdr.listAgents.mockResolvedValue([
      { paneId: 'w1:p9', status: 'working' }
    ]);
    await expect(service.liveStatuses()).resolves.toEqual(
      new Map([['w1:p9', 'working']])
    );
  });

  it('resubscribes live running runs on startup', async () => {
    prisma.agentRun.findMany.mockResolvedValue([
      { id: 1, paneId: 'w1:p9', ticket: { projectId: 3 } }
    ]);
    herdr.listAgents.mockResolvedValue([
      { paneId: 'w1:p9', status: 'working' }
    ]);
    await service.onModuleInit();
    expect(herdr.subscribeAgent).toHaveBeenCalledWith(
      'w1:p9',
      expect.any(Function)
    );
    expect(prisma.agentRun.update).not.toHaveBeenCalled();
  });

  it('fails running runs whose pane is gone on startup', async () => {
    prisma.agentRun.findMany.mockResolvedValue([
      { id: 1, paneId: 'w1:p9', ticket: { projectId: 3 } },
      { id: 2, paneId: null, ticket: { projectId: 3 } }
    ]);
    herdr.listAgents.mockResolvedValue([]);
    await service.onModuleInit();
    expect(herdr.subscribeAgent).not.toHaveBeenCalled();
    for (const id of [1, 2]) {
      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          status: 'FAILED',
          error: 'Agent pane is gone',
          finishedAt: expect.any(Date)
        }
      });
    }
  });

  it('keeps running runs when Herdr is unreachable on startup', async () => {
    prisma.agentRun.findMany.mockResolvedValue([
      { id: 1, paneId: 'w1:p9', ticket: { projectId: 3 } }
    ]);
    herdr.listAgents.mockRejectedValue(new Error('down'));
    await service.onModuleInit();
    expect(prisma.agentRun.update).not.toHaveBeenCalled();
  });
});
