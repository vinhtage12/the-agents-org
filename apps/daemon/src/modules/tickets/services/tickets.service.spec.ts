import {
  BadGatewayException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { TicketsService, suggestProjectId } from './tickets.service';

describe('TicketsService', () => {
  const tx = {
    ticket: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    project: { findUnique: jest.fn(), findMany: jest.fn() }
  };
  const prisma = { ...tx, $transaction: jest.fn() };
  const service = new TicketsService(
    prisma as unknown as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async callback => callback(tx));
    tx.ticket.findUnique.mockResolvedValue({
      id: 10,
      jiraKey: 'FMS-1',
      projectId: null,
      status: 'TODO'
    });
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.project.findUnique.mockResolvedValue({
      id: 3,
      defaultRepoId: 5,
      specAgentId: 11,
      devAgentId: 12,
      testAgentId: 13
    });
    tx.ticket.findMany.mockResolvedValue([]);
    tx.project.findMany.mockResolvedValue([]);
  });
  it('suggests by key prefix, case-insensitive', () => {
    const projects = [
      { id: 1, code: 'FMS' },
      { id: 2, code: 'APL-FMS' }
    ];
    expect(suggestProjectId('fms-412', projects)).toBe(1);
    expect(suggestProjectId('APL-FMS-3', projects)).toBe(2);
    expect(suggestProjectId('OPS-88', projects)).toBeNull();
  });
  it('copies project default agents by id when linking', async () => {
    await expect(
      service.link([{ ticketId: 10, projectId: 3 }])
    ).resolves.toEqual({ linked: 1 });
    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, projectId: null, status: { not: 'CANCELED' } },
      data: expect.objectContaining({
        projectId: 3,
        status: 'TODO',
        repoId: 5,
        specAgentId: 11,
        devAgentId: 12,
        testAgentId: 13,
        linkedAt: expect.any(Date)
      })
    });
  });
  it('rejects linking an already linked ticket', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      id: 10,
      jiraKey: 'FMS-1',
      projectId: 4
    });
    await expect(
      service.link([{ ticketId: 10, projectId: 3 }])
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a concurrent link rather than overwriting it', async () => {
    tx.ticket.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.link([{ ticketId: 10, projectId: 3 }])
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects linking a canceled ticket', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      id: 10,
      jiraKey: 'FMS-1',
      projectId: null,
      status: 'CANCELED'
    });
    await expect(
      service.link([{ ticketId: 10, projectId: 3 }])
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('store excludes linked and canceled tickets', async () => {
    await service.store();
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: null, status: { not: 'CANCELED' } }
      })
    );
  });
});

describe('TicketsService flow', () => {
  const prisma = {
    ticket: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    project: { findUnique: jest.fn(), findMany: jest.fn() },
    repo: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    specVersion: { findFirst: jest.fn(), update: jest.fn() },
    agentRun: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    testCase: { findMany: jest.fn() },
    $transaction: jest.fn()
  };
  const agentRuns = {
    startSpec: jest.fn(),
    stop: jest.fn(),
    closeTicketPanes: jest.fn(),
    liveStatuses: jest.fn()
  };
  const flow = { startDevelopment: jest.fn() };
  const git = {
    assertBranchName: jest.fn(),
    isClean: jest.fn(),
    branchExists: jest.fn(),
    createBranch: jest.fn(),
    push: jest.fn()
  };
  const board = { emitChanged: jest.fn() };
  const profiles = { assertRole: jest.fn() };
  const service = new TicketsService(
    prisma as unknown as PrismaService,
    agentRuns as never,
    board as never,
    profiles as never,
    flow as never,
    git as never
  );
  const ticket = {
    id: 10,
    jiraKey: 'FMS-1',
    summary: 'Login',
    description: '',
    jiraUrl: 'https://j/browse/FMS-1',
    status: 'TODO',
    projectId: 3,
    repoId: 5,
    specAgentId: 11,
    devAgentId: 12,
    testAgentId: 13,
    specAgentRef: null,
    devAgentRef: null,
    testAgentRef: null,
    skills: [],
    rules: [],
    branch: null,
    extraInstructions: '',
    fixRound: 0,
    specApprovedAt: null,
    project: { id: 3, workspaceId: 1 }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    prisma.ticket.update.mockResolvedValue(ticket);
    prisma.agentRun.count.mockResolvedValue(0);
    prisma.agentRun.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.repo.findMany.mockResolvedValue([]);
    prisma.specVersion.findFirst.mockResolvedValue(null);
    agentRuns.liveStatuses.mockResolvedValue(new Map());
    agentRuns.startSpec.mockResolvedValue({ id: 1 });
    agentRuns.stop.mockResolvedValue(1);
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.agentRun.findFirst.mockResolvedValue(null);
    prisma.repo.findUnique.mockResolvedValue({ id: 5, path: '/repo' });
    git.isClean.mockResolvedValue(true);
    git.branchExists.mockResolvedValue(false);
  });

  it('starts the spec agent when moving TODO → IN_SPEC', async () => {
    await service.move(10, 'IN_SPEC');
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'TODO' },
      data: { status: 'IN_SPEC' }
    });
    expect(agentRuns.startSpec).toHaveBeenCalledWith(10);
    expect(board.emitChanged).toHaveBeenCalledWith(3);
  });

  it('rejects moves outside the transition table', async () => {
    await expect(service.move(10, 'DONE')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('starts only one spec run for concurrent moves', async () => {
    prisma.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await service.move(10, 'IN_SPEC');
    await expect(service.move(10, 'IN_SPEC')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(agentRuns.startSpec).toHaveBeenCalledTimes(1);
  });

  it('moves the ticket back to TODO when the spec agent fails to start', async () => {
    agentRuns.startSpec.mockRejectedValue(
      new BadRequestException('Ticket has no repo')
    );
    await expect(service.move(10, 'IN_SPEC')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'TODO' }
    });
    expect(board.emitChanged).toHaveBeenCalledWith(3);
  });

  it('sends the edited spec with feedback', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW_SPEC',
      specApprovedAt: new Date()
    });
    prisma.specVersion.findFirst.mockResolvedValue({
      id: 4,
      version: 2,
      content: 'edited',
      editedAt: new Date()
    });
    await service.specFeedback(10, 'Split step 3');
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_REVIEW_SPEC' },
      data: { status: 'IN_SPEC', specApprovedAt: null }
    });
    expect(agentRuns.startSpec).toHaveBeenCalledWith(10, {
      version: 2,
      content: 'edited',
      feedback: 'Split step 3'
    });
  });

  it('returns to review when the feedback run cannot start', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW_SPEC'
    });
    prisma.specVersion.findFirst.mockResolvedValue({
      id: 4,
      version: 2,
      content: 'x'
    });
    agentRuns.startSpec.mockRejectedValue(new ConflictException('busy'));
    await expect(service.specFeedback(10, 'F')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'IN_REVIEW_SPEC' }
    });
  });

  it('editing an approved spec clears the approval', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW_SPEC',
      specApprovedAt: new Date()
    });
    prisma.specVersion.findFirst.mockResolvedValue({ id: 4, version: 2 });
    prisma.$transaction.mockImplementation(async ops => ops);
    await service.saveSpec(10, '# New');
    expect(prisma.specVersion.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { content: '# New', editedAt: expect.any(Date) }
    });
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { specApprovedAt: null }
    });
  });

  it('only reviews specs in In Review Spec', async () => {
    await expect(service.saveSpec(10, '# New')).rejects.toBeInstanceOf(
      ConflictException
    );
    await expect(service.approve(10)).rejects.toBeInstanceOf(ConflictException);
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW_SPEC'
    });
    await expect(service.approve(10)).rejects.toBeInstanceOf(ConflictException);
    prisma.specVersion.findFirst.mockResolvedValue({ id: 4, version: 1 });
    await service.approve(10);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { specApprovedAt: expect.any(Date) }
    });
  });

  it('locks the repo while an agent runs', async () => {
    prisma.repo.findFirst.mockResolvedValue({ id: 6, projectId: 3 });
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(service.update(10, { repoId: 6 })).rejects.toBeInstanceOf(
      ConflictException
    );
    await expect(
      service.update(10, { specAgentId: 99 })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a repo from another project and unknown agents', async () => {
    prisma.repo.findFirst.mockResolvedValue(null);
    await expect(service.update(10, { repoId: 77 })).rejects.toBeInstanceOf(
      BadRequestException
    );
    profiles.assertRole.mockRejectedValue(new BadRequestException('role'));
    await expect(service.update(10, { devAgentId: 99 })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('clears the saved branch when the repo changes', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      branch: 'feat/FMS-1'
    });
    prisma.repo.findFirst.mockResolvedValue({ id: 5 });
    await service.update(10, { repoId: 6 });
    expect(prisma.ticket.update.mock.calls[0][0].data.branch).toBeNull();
  });

  it('sets skills and rules on update', async () => {
    await service.update(10, { skillIds: [3], ruleIds: [4] });
    expect(prisma.ticket.update.mock.calls[0][0].data).toMatchObject({
      skills: { set: [{ id: 3 }] },
      rules: { set: [{ id: 4 }] }
    });
  });

  it('reports the running agent on board items', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 3 });
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 10,
        jiraKey: 'FMS-1',
        status: 'IN_PROGRESS',
        specApprovedAt: null,
        runs: [
          {
            status: 'RUNNING',
            paneId: null,
            startedAt: new Date(),
            agent: { id: 7, name: 'Dev' }
          }
        ],
        specs: []
      }
    ]);
    const items = await service.board(3);
    expect(items[0].agent).toEqual({ id: 7, name: 'Dev' });
  });

  it('locks the project after TODO', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_SPEC'
    });
    await expect(service.update(10, { projectId: 4 })).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('resets repo and agents to the new project defaults', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 4,
      defaultRepoId: 8,
      specAgentId: 21,
      devAgentId: 22,
      testAgentId: 23
    });
    await service.update(10, { projectId: 4, skillIds: [3] });
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        projectId: 4,
        repoId: 8,
        branch: null,
        specAgentId: 21,
        devAgentId: 22,
        testAgentId: 23,
        skills: { set: [{ id: 3 }] }
      }
    });
    expect(board.emitChanged).toHaveBeenCalledWith(3);
    expect(board.emitChanged).toHaveBeenCalledWith(4);
  });

  it('stops the spec agent and returns to To Do without a spec', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_SPEC'
    });
    await service.stop(10);
    expect(agentRuns.stop).toHaveBeenCalledWith(10, 'SPEC');
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'TODO' }
    });
    expect(board.emitChanged).toHaveBeenCalledWith(3);
  });

  it('stop moves a stuck In Spec ticket back even with no running run', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_SPEC'
    });
    agentRuns.stop.mockResolvedValue(0);
    await expect(service.stop(10)).resolves.toBeDefined();
    expect(agentRuns.stop).toHaveBeenCalledWith(10, 'SPEC');
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'TODO' }
    });
  });

  it('stops the spec agent and returns to review when a spec exists', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_SPEC'
    });
    prisma.specVersion.findFirst.mockResolvedValue({ id: 4, version: 1 });
    await service.stop(10);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'IN_REVIEW_SPEC' }
    });
  });

  it('rejects stopping when no runs are running', async () => {
    agentRuns.stop.mockResolvedValue(0);
    await expect(service.stop(10)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires an approved spec to start development', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW_SPEC'
    });
    await expect(service.move(10, 'IN_PROGRESS')).rejects.toThrow(
      'Spec is not approved'
    );
  });
  it('starts development with a fresh fix counter', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      branch: 'feat/FMS-1',
      status: 'IN_REVIEW_SPEC',
      specApprovedAt: new Date(),
      fixRound: 2
    });
    await service.move(10, 'IN_PROGRESS');
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_REVIEW_SPEC' },
      data: { status: 'IN_PROGRESS', fixRound: 0 }
    });
    expect(flow.startDevelopment).toHaveBeenCalledWith(10, {});
  });
  it('review feedback resets fix rounds', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW',
      fixRound: 2
    });
    await service.feedback(10, 'F');
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_REVIEW' },
      data: { status: 'IN_PROGRESS', fixRound: 0 }
    });
    expect(flow.startDevelopment).toHaveBeenCalledWith(10, { feedback: 'F' });
  });
  it('rejects feedback while an agent is running', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_TESTING'
    });
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(service.feedback(10, 'F')).rejects.toBeInstanceOf(
      ConflictException
    );
  });
  it('blocks moving to In Review while tests run', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_TESTING'
    });
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(service.move(10, 'IN_REVIEW')).rejects.toBeInstanceOf(
      ConflictException
    );
  });
  it('closes panes when the ticket is done', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW'
    });
    await service.move(10, 'DONE');
    expect(agentRuns.closeTicketPanes).toHaveBeenCalledWith(10);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_REVIEW' },
      data: { status: 'DONE' }
    });
  });
  it('stop keeps the column outside In Spec', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_PROGRESS'
    });
    await service.stop(10);
    expect(agentRuns.stop).toHaveBeenCalledWith(10);
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });
  it('lists other running tickets on the same repo', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      { id: 11, jiraKey: 'FMS-2', projectId: 3 }
    ]);
    await expect(service.repoConflicts(10)).resolves.toEqual({
      tickets: [{ id: 11, jiraKey: 'FMS-2', projectId: 3 }]
    });
    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: 10 },
        repoId: 5,
        runs: { some: { status: 'RUNNING' } }
      },
      select: { id: true, jiraKey: true, projectId: true }
    });
  });
  it('locks the dev agent while dev runs', async () => {
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(service.update(10, { devAgentId: 99 })).rejects.toBeInstanceOf(
      ConflictException
    );
  });
  it('only validates changed agents', async () => {
    await service.update(10, { devAgentId: 12, extraInstructions: 'F' });
    expect(profiles.assertRole).not.toHaveBeenCalled();
    await service.update(10, { devAgentId: 14 });
    expect(profiles.assertRole).toHaveBeenCalledWith(14, 'DEV');
  });

  it.each([
    'IN_REVIEW',
    'IN_TESTING',
    'IN_PROGRESS'
  ])('restores %s if feedback cannot start dev', async status => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status,
      fixRound: 2
    });
    flow.startDevelopment.mockRejectedValue(new Error('cannot start'));
    await expect(service.feedback(10, 'F')).rejects.toThrow('cannot start');
    expect(prisma.ticket.updateMany).toHaveBeenLastCalledWith({
      where: { id: 10, status: 'IN_PROGRESS' },
      data: { status }
    });
  });
  it('restores spec review if development cannot start', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      branch: 'feat/FMS-1',
      status: 'IN_REVIEW_SPEC',
      specApprovedAt: new Date()
    });
    flow.startDevelopment.mockRejectedValue(new Error('cannot start'));
    await expect(service.move(10, 'IN_PROGRESS')).rejects.toThrow(
      'cannot start'
    );
    expect(prisma.ticket.updateMany).toHaveBeenLastCalledWith({
      where: { id: 10, status: 'IN_PROGRESS' },
      data: { status: 'IN_REVIEW_SPEC' }
    });
  });
  it('rejects a lost conditional claim before starting development', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_REVIEW'
    });
    prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.feedback(10, 'F')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(flow.startDevelopment).not.toHaveBeenCalled();
  });
  it('locks the test agent while tests run', async () => {
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(
      service.update(10, { testAgentId: 99 })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.agentRun.count).toHaveBeenCalledWith({
      where: { ticketId: 10, status: 'RUNNING', step: 'TEST' }
    });
  });
  it('has no repo conflicts when no repo is selected', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...ticket, repoId: null });
    await expect(service.repoConflicts(10)).resolves.toEqual({ tickets: [] });
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });
  it('returns ordered cases, latest completed results and test modes in detail', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...ticket, fixRound: 2 });
    const cases = [
      { id: 4, position: 1, title: 'T', steps: 'S', expected: 'E' }
    ];
    prisma.testCase.findMany.mockResolvedValue(cases);
    const finishedAt = new Date();
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 8,
      finishedAt,
      results: [{ testCase: { position: 1 }, passed: false, detail: 'F' }]
    });
    prisma.agentRun.findMany.mockResolvedValue([
      { id: 8, status: 'COMPLETED', testMode: 'RUN_CASES' }
    ]);
    const detail = await service.detail(10);
    expect(detail).toMatchObject({
      fixRound: 2,
      testCases: cases,
      testResults: {
        agentRunId: 8,
        finishedAt,
        results: [{ position: 1, passed: false, detail: 'F' }]
      },
      runs: [{ testMode: 'RUN_CASES' }]
    });
    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { position: 'asc' } })
    );
    expect(prisma.agentRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ticketId: 10,
          step: 'TEST',
          testMode: 'RUN_CASES',
          status: 'COMPLETED'
        },
        orderBy: { id: 'desc' }
      })
    );
  });

  it('labels board cards from live agent status in one Herdr call', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 10,
        jiraKey: 'FMS-1',
        summary: 'Login',
        status: 'IN_SPEC',
        jiraUrl: 'u',
        specApprovedAt: null,
        runs: [
          {
            status: 'RUNNING',
            paneId: 'w1:p9',
            startedAt: new Date(0),
            agent: { id: 7, name: 'Spec' }
          }
        ],
        specs: [{ version: 2 }]
      },
      {
        id: 11,
        jiraKey: 'FMS-2',
        summary: 'Logout',
        status: 'TODO',
        jiraUrl: 'u',
        specApprovedAt: null,
        runs: [],
        specs: []
      }
    ]);
    prisma.project.findUnique.mockResolvedValue({ id: 3 });
    agentRuns.liveStatuses.mockResolvedValue(new Map([['w1:p9', 'idle']]));
    await expect(service.board(3)).resolves.toEqual([
      {
        id: 10,
        jiraKey: 'FMS-1',
        summary: 'Login',
        status: 'IN_SPEC',
        jiraUrl: 'u',
        branch: undefined,
        repoId: undefined,
        agent: { id: 7, name: 'Spec' },
        label: 'needs_you',
        specVersion: 2
      },
      {
        id: 11,
        jiraKey: 'FMS-2',
        summary: 'Logout',
        status: 'TODO',
        jiraUrl: 'u',
        branch: undefined,
        repoId: undefined,
        agent: null,
        label: null,
        specVersion: null
      }
    ]);
    expect(agentRuns.liveStatuses).toHaveBeenCalledTimes(1);
  });

  describe('first move to In Progress', () => {
    const approved = {
      ...ticket,
      status: 'IN_REVIEW_SPEC',
      specApprovedAt: new Date()
    };
    const branch = { base: 'main', name: 'feat/FMS-1', push: false };
    beforeEach(() => {
      prisma.ticket.findUnique.mockResolvedValue(approved);
    });

    it('requires a branch on the first move to In Progress', async () => {
      await expect(service.move(10, 'IN_PROGRESS')).rejects.toThrow(
        'Branch required'
      );
      expect(git.createBranch).not.toHaveBeenCalled();
    });

    it('blocks when another ticket runs an agent on the repo', async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { id: 11, jiraKey: 'FMS-2', projectId: 3 }
      ]);
      await expect(
        service.move(10, 'IN_PROGRESS', branch)
      ).rejects.toBeInstanceOf(ConflictException);
      expect(git.createBranch).not.toHaveBeenCalled();
    });

    it('blocks a dirty repo and an existing branch', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      git.isClean.mockResolvedValue(false);
      await expect(
        service.move(10, 'IN_PROGRESS', branch)
      ).rejects.toBeInstanceOf(ConflictException);
      git.isClean.mockResolvedValue(true);
      git.branchExists.mockResolvedValue(true);
      await expect(
        service.move(10, 'IN_PROGRESS', branch)
      ).rejects.toBeInstanceOf(ConflictException);
      expect(git.createBranch).not.toHaveBeenCalled();
    });

    it('rejects invalid branch names before any git change', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      git.assertBranchName.mockRejectedValue(new BadRequestException('bad'));
      await expect(
        service.move(10, 'IN_PROGRESS', { ...branch, name: 'a b' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(git.createBranch).not.toHaveBeenCalled();
    });

    it('creates the branch before starting agents', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      const order: string[] = [];
      git.createBranch.mockImplementation(async () => void order.push('git'));
      flow.startDevelopment.mockImplementation(
        async () => void order.push('dev')
      );
      await service.move(10, 'IN_PROGRESS', branch);
      expect(order).toEqual(['git', 'dev']);
      expect(git.createBranch).toHaveBeenCalledWith(
        '/repo',
        'main',
        'feat/FMS-1'
      );
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { branch: 'feat/FMS-1' }
      });
    });

    it('keeps the branch and does not move when push fails', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      git.push.mockRejectedValue(new Error('no remote'));
      await expect(
        service.move(10, 'IN_PROGRESS', { ...branch, push: true })
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { branch: 'feat/FMS-1' }
      });
      expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
      expect(flow.startDevelopment).not.toHaveBeenCalled();
    });

    it('moves without git when the ticket already has a branch', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...approved,
        branch: 'feat/FMS-1'
      });
      await service.move(10, 'IN_PROGRESS');
      expect(git.createBranch).not.toHaveBeenCalled();
      expect(flow.startDevelopment).toHaveBeenCalled();
    });
  });
});
