import { BadRequestException, ConflictException } from '@nestjs/common';

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
      specAgent: 'analyst',
      devAgent: 'fe-dev',
      testAgent: 'qa'
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
  it('links with project defaults', async () => {
    await expect(
      service.link([{ ticketId: 10, projectId: 3 }])
    ).resolves.toEqual({ linked: 1 });
    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, projectId: null, status: { not: 'CANCELED' } },
      data: expect.objectContaining({
        projectId: 3,
        status: 'TODO',
        repoId: 5,
        specAgent: 'analyst',
        devAgent: 'fe-dev',
        testAgent: 'qa',
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
    projectRepo: { findFirst: jest.fn(), findMany: jest.fn() },
    specVersion: { findFirst: jest.fn(), update: jest.fn() },
    agentRun: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn()
  };
  const agentRuns = {
    startSpec: jest.fn(),
    stopSpec: jest.fn(),
    liveStatuses: jest.fn()
  };
  const board = { emitChanged: jest.fn() };
  const profiles = { assertExists: jest.fn() };
  const service = new TicketsService(
    prisma as unknown as PrismaService,
    agentRuns as never,
    board as never,
    profiles as never
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
    specAgent: 'analyst',
    devAgent: 'fe-dev',
    testAgent: 'qa',
    extraInstructions: '',
    extraSkills: [],
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
    prisma.projectRepo.findMany.mockResolvedValue([]);
    prisma.specVersion.findFirst.mockResolvedValue(null);
    agentRuns.liveStatuses.mockResolvedValue(new Map());
    agentRuns.startSpec.mockResolvedValue({ id: 1 });
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
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 10 },
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
    await service.feedback(10, 'Split step 3');
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
    await expect(service.feedback(10, 'F')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 10 },
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
    prisma.projectRepo.findFirst.mockResolvedValue({ id: 6, projectId: 3 });
    prisma.agentRun.count.mockResolvedValue(1);
    await expect(service.update(10, { repoId: 6 })).rejects.toBeInstanceOf(
      ConflictException
    );
    await expect(
      service.update(10, { specAgent: 'other' })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a repo from another project and unknown agents', async () => {
    prisma.projectRepo.findFirst.mockResolvedValue(null);
    await expect(service.update(10, { repoId: 77 })).rejects.toBeInstanceOf(
      BadRequestException
    );
    profiles.assertExists.mockRejectedValue(
      new BadRequestException('Unknown agent: x')
    );
    await expect(service.update(10, { devAgent: 'x' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.ticket.update).not.toHaveBeenCalled();
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
      specAgent: 'a2',
      devAgent: 'd2',
      testAgent: 't2'
    });
    await service.update(10, { projectId: 4, extraSkills: ['jira'] });
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        projectId: 4,
        repoId: 8,
        specAgent: 'a2',
        devAgent: 'd2',
        testAgent: 't2',
        extraSkills: ['jira']
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
    await service.stopSpec(10);
    expect(agentRuns.stopSpec).toHaveBeenCalledWith(10);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'TODO' }
    });
    expect(board.emitChanged).toHaveBeenCalledWith(3);
  });

  it('stops the spec agent and returns to review when a spec exists', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: 'IN_SPEC'
    });
    prisma.specVersion.findFirst.mockResolvedValue({ id: 4, version: 1 });
    await service.stopSpec(10);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: 'IN_SPEC' },
      data: { status: 'IN_REVIEW_SPEC' }
    });
  });

  it('only stops tickets that are In Spec', async () => {
    await expect(service.stopSpec(10)).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(agentRuns.stopSpec).not.toHaveBeenCalled();
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
        runs: [{ status: 'RUNNING', paneId: 'w1:p9', startedAt: new Date(0) }],
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
        label: 'needs_you',
        specVersion: 2
      },
      {
        id: 11,
        jiraKey: 'FMS-2',
        summary: 'Logout',
        status: 'TODO',
        jiraUrl: 'u',
        label: null,
        specVersion: null
      }
    ]);
    expect(agentRuns.liveStatuses).toHaveBeenCalledTimes(1);
  });
});
