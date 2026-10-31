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

import { AgentRunsService } from './agent-runs.service';
import { TicketFlowService } from './ticket-flow.service';

import type { PrismaService } from '../../../database/prisma.service';

describe('TicketFlowService', () => {
  const ticket = { id: 10, projectId: 3, status: 'IN_PROGRESS', fixRound: 0 };
  const cases = [
    { id: 11, position: 1, title: 'Login', steps: 'S', expected: 'E' },
    { id: 12, position: 2, title: 'Logout', steps: 'S', expected: 'E' }
  ];
  const tx = {
    ticket: { findUnique: jest.fn(), update: jest.fn() },
    specVersion: { aggregate: jest.fn(), create: jest.fn() },
    testCase: { deleteMany: jest.fn(), createMany: jest.fn() },
    testResult: { createMany: jest.fn() }
  };
  const prisma = {
    ticket: { findUnique: jest.fn() },
    specVersion: { findFirst: jest.fn() },
    testCase: { count: jest.fn(), findMany: jest.fn() },
    agentRun: { count: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn()
  };
  const runs = {
    claim: jest.fn(),
    finish: jest.fn(),
    afterFinish: jest.fn(),
    start: jest.fn()
  };
  let flow: TicketFlowService;
  let current: typeof ticket;
  let storedCases: typeof cases;
  let testing: boolean;
  let committed: boolean;

  beforeEach(() => {
    jest.resetAllMocks();
    current = { ...ticket };
    storedCases = [...cases];
    testing = false;
    committed = false;
    flow = new TicketFlowService(
      prisma as unknown as PrismaService,
      runs as unknown as AgentRunsService
    );
    prisma.ticket.findUnique.mockImplementation(async () => current);
    tx.ticket.findUnique.mockImplementation(async () => current);
    tx.ticket.update.mockImplementation(async ({ data }) =>
      Object.assign(current, data)
    );
    prisma.testCase.findMany.mockImplementation(async () => storedCases);
    prisma.testCase.count.mockImplementation(async () => storedCases.length);
    prisma.specVersion.findFirst.mockResolvedValue({ content: '# Approved' });
    prisma.agentRun.count.mockImplementation(async () => (testing ? 1 : 0));
    prisma.agentRun.findFirst.mockImplementation(async ({ where }) =>
      where.step === 'DEV' ? { id: 20 } : null
    );
    prisma.$transaction.mockImplementation(async callback => {
      const result = await callback(tx);
      committed = true;
      return result;
    });
    runs.claim.mockResolvedValue({
      run: { id: 20, ticketId: 10, step: 'DEV' },
      output: 'Done'
    });
    runs.start.mockImplementation((_id, step) => {
      if (step === 'TEST') testing = true;
    });
    tx.testCase.createMany.mockImplementation(({ data }) => {
      storedCases = data;
    });
  });

  function results(fixRound: number, passed: boolean) {
    current.status = 'IN_TESTING';
    current.fixRound = fixRound;
    runs.claim.mockResolvedValue({
      run: { id: 21, ticketId: 10, step: 'TEST', testMode: 'RUN_CASES' },
      output: JSON.stringify({
        results: cases.map(c => ({
          position: c.position,
          passed,
          detail: 'broken'
        }))
      })
    });
  }

  it('moves to In Testing when dev completes and runs cases if they exist', async () => {
    runs.start.mockImplementation(() => {
      expect(committed).toBe(true);
    });
    await flow.complete(20, 'tok');
    expect(current.status).toBe('IN_TESTING');
    expect(runs.finish).toHaveBeenCalledWith(tx, 20, 'COMPLETED');
    expect(runs.afterFinish).toHaveBeenCalledWith(20, 3);
    expect(runs.start).toHaveBeenCalledWith(10, 'TEST', expect.any(Function), {
      testMode: 'RUN_CASES'
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('runs cases once both dev and case writing are done', async () => {
    storedCases = [];
    await flow.complete(20, 'tok');
    expect(runs.start).not.toHaveBeenCalled();
    runs.claim.mockResolvedValue({
      run: { id: 21, ticketId: 10, step: 'TEST', testMode: 'WRITE_CASES' },
      output: '{"cases":[{"title":"T","steps":"S","expected":"E"}]}'
    });
    await flow.complete(21, 'tok');
    await flow.maybeRunCases(10);
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(runs.start).toHaveBeenCalledWith(10, 'TEST', expect.any(Function), {
      testMode: 'RUN_CASES'
    });
    expect(tx.testCase.deleteMany).toHaveBeenCalledWith({
      where: { ticketId: 10 }
    });
    expect(tx.testCase.createMany).toHaveBeenCalledWith({
      data: [
        { ticketId: 10, position: 1, title: 'T', steps: 'S', expected: 'E' }
      ]
    });
  });

  it('sends every failure back to dev and counts the round', async () => {
    results(0, false);
    runs.start.mockImplementation(() => {
      expect(committed).toBe(true);
    });
    await flow.complete(21, 'tok');
    expect(current).toMatchObject({ status: 'IN_PROGRESS', fixRound: 1 });
    const [id, step, build] = runs.start.mock.calls[0];
    expect([id, step]).toEqual([10, 'DEV']);
    const prompt = build({
      profile: { skills: [], instructions: '' },
      ticket: { extraSkills: [], extraInstructions: '' },
      repoPath: '/repo',
      run: { dir: '/runs/22' }
    });
    expect(prompt).toContain('#1 Login: broken');
    expect(prompt).toContain('#2 Logout: broken');
    expect(tx.testResult.createMany).toHaveBeenCalledWith({
      data: [
        { agentRunId: 21, testCaseId: 11, passed: false, detail: 'broken' },
        { agentRunId: 21, testCaseId: 12, passed: false, detail: 'broken' }
      ]
    });
  });

  it('stops after two fix rounds', async () => {
    results(2, false);
    await flow.complete(21, 'tok');
    expect(current).toMatchObject({ status: 'IN_TESTING', fixRound: 2 });
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('moves to In Review when every case passes', async () => {
    results(0, true);
    await flow.complete(21, 'tok');
    expect(current.status).toBe('IN_REVIEW');
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('rejects malformed test output', async () => {
    for (const testMode of ['WRITE_CASES', 'RUN_CASES']) {
      runs.claim.mockResolvedValue({
        run: { id: 21, ticketId: 10, step: 'TEST', testMode },
        output: 'nope'
      });
      await expect(flow.complete(21, 'tok')).rejects.toBeInstanceOf(
        BadRequestException
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(runs.finish).not.toHaveBeenCalled();
  });

  it('ignores late callbacks for tickets that left the step', async () => {
    results(0, false);
    current.status = 'CANCELED';
    await flow.complete(21, 'tok');
    expect(runs.finish).toHaveBeenCalledWith(tx, 21, 'STOPPED');
    expect(tx.testResult.createMany).not.toHaveBeenCalled();
    expect(tx.ticket.update).not.toHaveBeenCalled();
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('starts dev and case writing in parallel the first time', async () => {
    storedCases = [];
    await flow.startDevelopment(10, {});
    expect(runs.start.mock.calls.map(call => call[1])).toEqual(['DEV', 'TEST']);
    expect(runs.start).toHaveBeenLastCalledWith(
      10,
      'TEST',
      expect.any(Function),
      { testMode: 'WRITE_CASES' }
    );
  });

  it('does not rewrite cases that already exist', async () => {
    await flow.startDevelopment(10, { feedback: 'F' });
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(runs.start.mock.calls[0][1]).toBe('DEV');
  });

  it('does not rerun cases without a newer completed dev run', async () => {
    current.status = 'IN_TESTING';
    prisma.agentRun.findFirst.mockImplementation(async ({ where }) => ({
      id: where.step === 'DEV' ? 20 : 21
    }));
    await flow.maybeRunCases(10);
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('keeps dev running if case writing cannot start', async () => {
    storedCases = [];
    runs.start
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('test startup failed'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await expect(flow.startDevelopment(10, {})).resolves.toBeUndefined();
      expect(runs.start.mock.calls.map(call => call[1])).toEqual([
        'DEV',
        'TEST'
      ]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('test startup failed')
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('waits for dev when cases finish first', async () => {
    runs.claim.mockResolvedValue({
      run: { id: 19, ticketId: 10, step: 'TEST', testMode: 'WRITE_CASES' },
      output: '{"cases":[{"title":"T","steps":"S","expected":"E"}]}'
    });
    await flow.complete(19, 'tok');
    expect(runs.start).not.toHaveBeenCalled();
    runs.claim.mockResolvedValue({
      run: { id: 20, ticketId: 10, step: 'DEV' },
      output: 'Done'
    });
    await flow.complete(20, 'tok');
    expect(runs.start).toHaveBeenCalledTimes(1);
  });

  it('does not start tests without each required prerequisite', async () => {
    await flow.maybeRunCases(10);
    current.status = 'IN_TESTING';
    testing = true;
    await flow.maybeRunCases(10);
    testing = false;
    storedCases = [];
    await flow.maybeRunCases(10);
    storedCases = [...cases];
    prisma.agentRun.findFirst.mockResolvedValue(null);
    await flow.maybeRunCases(10);
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('does not start case writing while a test run is running', async () => {
    storedCases = [];
    testing = true;
    await flow.startDevelopment(10, {});
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(runs.start.mock.calls[0][1]).toBe('DEV');
  });

  it('still acknowledges the callback when the follow-up run cannot start', async () => {
    results(0, false);
    runs.start.mockRejectedValue(new Error('Herdr down'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await expect(flow.complete(21, 'tok')).resolves.toBeUndefined();
      expect(committed).toBe(true);
      expect(current).toMatchObject({ status: 'IN_PROGRESS', fixRound: 1 });
      expect(runs.finish).toHaveBeenCalledWith(tx, 21, 'COMPLETED');
      expect(runs.afterFinish).toHaveBeenCalledWith(21, 3);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('10'));
    } finally {
      warn.mockRestore();
    }
  });

  it('still acknowledges dev completion when maybeRunCases cannot start a run', async () => {
    runs.start.mockRejectedValue(new Error('No test agent'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await expect(flow.complete(20, 'tok')).resolves.toBeUndefined();
      expect(committed).toBe(true);
      expect(current.status).toBe('IN_TESTING');
      expect(runs.finish).toHaveBeenCalledWith(tx, 20, 'COMPLETED');
      expect(runs.afterFinish).toHaveBeenCalledWith(20, 3);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('10'));
    } finally {
      warn.mockRestore();
    }
  });

  it('does not launch follow-up work if finish conflicts', async () => {
    runs.finish.mockRejectedValue(new ConflictException());
    await expect(flow.complete(20, 'tok')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(runs.afterFinish).not.toHaveBeenCalled();
    expect(runs.start).not.toHaveBeenCalled();
  });
});

describe('SPEC completion migrated from AgentRunsService', () => {
  let runsDir: string;
  const tx = {
    ticket: { findUnique: jest.fn(), update: jest.fn() },
    specVersion: { aggregate: jest.fn(), create: jest.fn() },
    agentRun: { updateMany: jest.fn() }
  };
  const prisma = {
    agentRun: { findUnique: jest.fn() },
    $transaction: jest.fn()
  };
  const board = { emitChanged: jest.fn() };
  let flow: TicketFlowService;
  beforeEach(async () => {
    jest.resetAllMocks();
    runsDir = await mkdtemp(join(tmpdir(), 'flow-runs-'));
    const service = new AgentRunsService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      board as never,
      {
        get: (key: string) => ({ RUNS_DIR: runsDir, PORT: 3005 })[key]
      } as never
    );
    flow = new TicketFlowService(prisma as unknown as PrismaService, service);
    tx.agentRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async callback => callback(tx));
  });
  describe('complete', () => {
    const runs: Record<number, object> = {
      1: {
        id: 1,
        ticketId: 10,
        token: 'tok',
        status: 'RUNNING',
        step: 'SPEC',
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
      await expect(flow.complete(9, 'tok')).rejects.toBeInstanceOf(
        NotFoundException
      );
      await expect(flow.complete(1, 'wrong')).rejects.toBeInstanceOf(
        ForbiddenException
      );
      await expect(flow.complete(1, 'tok')).rejects.toBeInstanceOf(
        BadRequestException
      );
      await mkdir(join(runsDir, '1'), { recursive: true });
      await writeFile(join(runsDir, '1', 'output.md'), '  \n');
      await expect(flow.complete(1, 'tok')).rejects.toBeInstanceOf(
        BadRequestException
      );
      await expect(flow.complete(2, 'tok')).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('stores a new spec version and moves the ticket to review', async () => {
      await mkdir(join(runsDir, '1'), { recursive: true });
      await writeFile(join(runsDir, '1', 'output.md'), '# Spec\n');
      await flow.complete(1, 'tok');
      expect(tx.specVersion.create).toHaveBeenCalledWith({
        data: { ticketId: 10, version: 2, content: '# Spec', feedback: 'F' }
      });
      expect(tx.ticket.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'IN_REVIEW_SPEC', specApprovedAt: null }
      });
      expect(tx.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 1, status: 'RUNNING' },
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
      await flow.complete(1, 'tok');
      expect(tx.specVersion.create).not.toHaveBeenCalled();
      expect(tx.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 1, status: 'RUNNING' },
        data: { status: 'STOPPED', finishedAt: expect.any(Date) }
      });
    });
  });
});
