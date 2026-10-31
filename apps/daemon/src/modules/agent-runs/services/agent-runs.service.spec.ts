import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
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
    agentRun: { update: jest.fn(), updateMany: jest.fn() }
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
      devAgent: 'fe-dev',
      testAgent: 'tester',
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
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id,
      paneId: 'w1:p9',
      status: 'RUNNING'
    }));
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
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'RUNNING' },
      data: { paneId: 'w1:p9' }
    });
    expect(herdr.subscribeAgent).toHaveBeenCalledWith(
      'w1:p9',
      expect.any(Function)
    );
  });

  it('rejects a concurrent start of the same step', async () => {
    prisma.agentRun.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.startSpec(10)).rejects.toThrow(
      'Spec agent is already running'
    );
    expect(herdr.createAgent).not.toHaveBeenCalled();
    expect(herdr.sendPrompt).not.toHaveBeenCalled();
  });

  it('does not start agents on canceled tickets', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: 10,
      status: 'CANCELED',
      repo: { id: 5, path: repoDir },
      specAgent: 'analyst'
    });
    await expect(service.startSpec(10)).rejects.toThrow('Ticket is closed');
    expect(prisma.agentRun.create).not.toHaveBeenCalled();
  });

  it('closes the pane when the run was stopped while starting', async () => {
    prisma.agentRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.startSpec(10)).rejects.toThrow(
      'Agent run was stopped while starting'
    );
    expect(herdr.closeAgent).toHaveBeenCalledWith('w1:p9');
  });

  it('announces a started run on the board immediately', async () => {
    await service.startSpec(10);
    expect(board.emitChanged).toHaveBeenCalledWith(3);
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

  it('starts a dev run with the dev agent in its own pane', async () => {
    profiles.get.mockResolvedValue({
      slug: 'fe-dev',
      provider: 'claude',
      skills: [],
      instructions: ''
    });
    prisma.agentRun.findFirst.mockImplementation(async ({ where }) =>
      where.step === 'SPEC' ? { paneId: 'w1:p4', agentSlug: 'fe-dev' } : null
    );
    herdr.listAgents.mockResolvedValue([{ paneId: 'w1:p4', cwd: repoDir }]);
    await service.start(10, 'DEV', () => 'Implement');
    expect(profiles.get).toHaveBeenCalledWith('fe-dev');
    expect(prisma.agentRun.count).toHaveBeenCalledWith({
      where: { ticketId: 10, step: 'DEV', status: 'RUNNING' }
    });
    expect(prisma.agentRun.findFirst).toHaveBeenCalledWith({
      where: { ticketId: 10, step: 'DEV', paneId: { not: null } },
      orderBy: { id: 'desc' }
    });
    expect(herdr.createAgent).toHaveBeenCalled();
    expect(herdr.sendPrompt).toHaveBeenCalledWith('w1:p9', 'Implement');
    expect(herdr.closeAgent).not.toHaveBeenCalled();
  });

  it('stores the test mode on the run', async () => {
    await service.start(10, 'TEST', () => 'Test', { testMode: 'WRITE_CASES' });
    expect(profiles.get).toHaveBeenCalledWith('tester');
    expect(prisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ step: 'TEST', testMode: 'WRITE_CASES' })
    });
  });

  it('claim reads output.json for testing runs', async () => {
    const run = { id: 1, token: 'tok', step: 'TEST', status: 'RUNNING' };
    prisma.agentRun.findUnique.mockResolvedValue(run);
    await mkdir(join(runsDir, '1'), { recursive: true });
    await writeFile(join(runsDir, '1', 'output.json'), ' {"cases":[]} ');
    await expect(service.claim(1, 'tok')).resolves.toEqual({
      run,
      output: '{"cases":[]}'
    });
    expect(prisma.agentRun.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('finish rejects a run that is no longer running', async () => {
    tx.agentRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.finish(
        tx as unknown as import('../../../generated/prisma/client').Prisma.TransactionClient,
        1,
        'COMPLETED'
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('closeTicketPanes stops runs and closes each pane once', async () => {
    prisma.agentRun.findMany
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([
        { paneId: 'w1:p4' },
        { paneId: 'w1:p4' },
        { paneId: 'w1:p5' }
      ]);
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });
    herdr.closeAgent.mockRejectedValue(new Error('gone'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await expect(service.closeTicketPanes(10)).resolves.toBeUndefined();
      expect(prisma.agentRun.updateMany).toHaveBeenCalledWith({
        where: { ticketId: 10, status: 'RUNNING' },
        data: { status: 'STOPPED', finishedAt: expect.any(Date) }
      });
      expect(herdr.closeAgent).toHaveBeenCalledTimes(2);
      expect(herdr.closeAgent).toHaveBeenCalledWith('w1:p4');
      expect(herdr.closeAgent).toHaveBeenCalledWith('w1:p5');
    } finally {
      warn.mockRestore();
    }
  });

  it('claim validates callbacks without changing state', async () => {
    prisma.agentRun.findUnique.mockResolvedValue(null);
    await expect(service.claim(9, 'tok')).rejects.toBeInstanceOf(
      NotFoundException
    );
    prisma.agentRun.findUnique.mockResolvedValue({
      id: 1,
      token: 'tok',
      step: 'DEV',
      status: 'RUNNING'
    });
    await expect(service.claim(1, 'wrong')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.claim(1, 'tok')).rejects.toThrow(
      'output.md is missing or empty'
    );
    await mkdir(join(runsDir, '1'), { recursive: true });
    await writeFile(join(runsDir, '1', 'output.md'), '  ');
    await expect(service.claim(1, 'tok')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await writeFile(join(runsDir, '1', 'output.md'), '# Changed');
    await expect(service.claim(1, 'tok')).resolves.toMatchObject({
      output: '# Changed'
    });
    prisma.agentRun.findUnique.mockResolvedValue({
      id: 1,
      token: 'tok',
      status: 'COMPLETED'
    });
    await expect(service.claim(1, 'tok')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.agentRun.update).not.toHaveBeenCalled();
    expect(prisma.agentRun.updateMany).not.toHaveBeenCalled();
  });

  it('finish atomically updates only a running run', async () => {
    tx.agentRun.updateMany.mockResolvedValue({ count: 1 });
    await service.finish(
      tx as unknown as import('../../../generated/prisma/client').Prisma.TransactionClient,
      1,
      'STOPPED'
    );
    expect(tx.agentRun.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'RUNNING' },
      data: { status: 'STOPPED', finishedAt: expect.any(Date) }
    });
  });

  it('afterFinish unsubscribes once and emits only for a project', async () => {
    const unsubscribe = jest.fn();
    herdr.subscribeAgent.mockReturnValue(unsubscribe);
    await service.startSpec(10);
    board.emitChanged.mockClear();
    service.afterFinish(1, 3);
    service.afterFinish(1, null);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(board.emitChanged).toHaveBeenCalledTimes(1);
    expect(board.emitChanged).toHaveBeenCalledWith(3);
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
