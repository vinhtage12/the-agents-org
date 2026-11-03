import { Logger, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { JiraClient, JiraHttpError } from '../clients/jira.client';
import { JiraSyncService } from './jira-sync.service';

describe('JiraSyncService', () => {
  const issue = {
    key: 'FMS-1',
    summary: 'A',
    description: 'B',
    issueType: 'Task',
    status: 'Open',
    assigneeAccountId: 'me',
    sprints: []
  };
  const active = {
    id: 7,
    name: 'Sprint 7',
    state: 'active' as const,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-02-01T00:00:00.000Z',
    boardId: 4
  };
  const jira = {
    isConfigured: jest.fn(),
    myself: jest.fn(),
    search: jest.fn(),
    getIssue: jest.fn(),
    sprintFieldId: jest.fn(),
    getSprint: jest.fn(),
    browseUrl: jest.fn()
  };
  const prisma = {
    ticket: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    sprint: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };
  const agentRuns = { closeTicketPanes: jest.fn() };
  const board = { emitChanged: jest.fn() };
  const service = new JiraSyncService(
    jira as unknown as JiraClient,
    prisma as unknown as PrismaService,
    agentRuns as never,
    board as never
  );
  beforeEach(() => {
    jest.resetAllMocks();
    jira.isConfigured.mockReturnValue(true);
    jira.myself.mockResolvedValue({ accountId: 'me' });
    jira.search.mockResolvedValue([issue]);
    jira.browseUrl.mockReturnValue('https://jira/browse/FMS-1');
    agentRuns.closeTicketPanes.mockResolvedValue(undefined);
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.findUnique.mockResolvedValue(null);
    jira.sprintFieldId.mockResolvedValue(null);
    prisma.sprint.findMany.mockResolvedValue([]);
  });
  it('creates new tickets unlinked in TODO', async () => {
    expect((await service.sync()).created).toBe(1);
    expect(prisma.ticket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jiraKey: 'FMS-1', status: 'TODO' })
    });
    expect(
      prisma.ticket.create.mock.calls[0][0].data.projectId
    ).toBeUndefined();
  });
  it('is idempotent on repeated sync', async () => {
    await service.sync();
    prisma.ticket.findUnique.mockResolvedValue({
      jiraKey: 'FMS-1',
      status: 'IN_PROGRESS',
      projectId: 3
    });
    expect(await service.sync()).toMatchObject({ created: 0, updated: 1 });
    const data = prisma.ticket.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('projectId');
  });
  it('updates when a concurrent sync creates the same ticket first', async () => {
    prisma.ticket.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.sync()).resolves.toMatchObject({
      created: 0,
      updated: 1
    });
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { jiraKey: 'FMS-1' },
      data: expect.objectContaining({ summary: 'A' })
    });
    expect(prisma.ticket.update.mock.calls[0][0].data).not.toHaveProperty(
      'status'
    );
  });
  it('cancels tickets reassigned to someone else', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      { jiraKey: 'FMS-1', status: 'IN_PROGRESS' }
    ]);
    jira.search
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...issue, assigneeAccountId: 'other' }]);
    expect((await service.sync()).canceled).toBe(1);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { jiraKey: 'FMS-1' },
      data: { status: 'CANCELED' }
    });
  });
  it('does not cancel tickets closed in Jira but still assigned', async () => {
    prisma.ticket.findMany.mockResolvedValue([{ jiraKey: 'FMS-1' }]);
    jira.search
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...issue, status: 'Done' }]);
    expect((await service.sync()).canceled).toBe(0);
    expect(prisma.ticket.update.mock.calls[0][0].data).not.toHaveProperty(
      'status'
    );
  });
  it('reopens canceled tickets assigned back to TODO', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      jiraKey: 'FMS-1',
      status: 'CANCELED'
    });
    expect((await service.sync()).reopened).toBe(1);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { jiraKey: 'FMS-1' },
      data: expect.objectContaining({ status: 'TODO' })
    });
  });
  it('stops agents before canceling', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      { id: 10, jiraKey: 'FMS-1', projectId: 3 }
    ]);
    jira.search
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...issue, assigneeAccountId: 'other' }]);
    await service.sync();
    expect(agentRuns.closeTicketPanes.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.ticket.update.mock.invocationCallOrder[0]
    );
    expect(board.emitChanged).toHaveBeenCalledWith(3);
  });
  it('reopened tickets restart the fix counter', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      jiraKey: 'FMS-1',
      status: 'CANCELED'
    });
    await service.sync();
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'TODO', fixRound: 0 })
      })
    );
  });
  it('throws 503 when Jira is not configured', async () => {
    jira.isConfigured.mockReturnValue(false);
    await expect(service.sync()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
  it('cancels tickets deleted from Jira', async () => {
    prisma.ticket.findMany.mockResolvedValue([{ jiraKey: 'FMS-1' }]);
    jira.search.mockResolvedValue([]);
    expect((await service.sync()).canceled).toBe(1);
  });
  it('falls back to per-key lookup when the batch query rejects unknown keys', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      { jiraKey: 'FMS-1' },
      { jiraKey: 'FMS-2' }
    ]);
    jira.search
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new JiraHttpError(400));
    jira.getIssue.mockImplementation(async (key: string) =>
      key === 'FMS-2' ? { ...issue, key: 'FMS-2' } : null
    );
    const result = await service.sync();
    expect(jira.getIssue).toHaveBeenCalledTimes(2);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { jiraKey: 'FMS-1' },
      data: { status: 'CANCELED' }
    });
    expect(result).toMatchObject({ canceled: 1, updated: 1 });
  });
  it('still fails sync on other Jira errors in the re-check', async () => {
    prisma.ticket.findMany.mockResolvedValue([{ jiraKey: 'FMS-1' }]);
    jira.search
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new JiraHttpError(500));
    await expect(service.sync()).rejects.toBeInstanceOf(JiraHttpError);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
  describe('sprints', () => {
    beforeEach(() => {
      jira.sprintFieldId.mockResolvedValue('customfield_10020');
      prisma.sprint.upsert.mockResolvedValue({ id: 70 });
    });
    it('only rechecks JIRA tickets and never updates LOCAL ones', async () => {
      await service.sync();
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'JIRA' })
        })
      );
    });
    it('upserts the issue sprint and stores its DB id on the ticket', async () => {
      jira.search.mockResolvedValue([{ ...issue, sprints: [active] }]);
      const result = await service.sync();
      expect(prisma.sprint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { jiraSprintId: 7 } })
      );
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sprintId: 70 })
      });
      expect(result.sprints).toBe(1);
    });
    it('keeps a LOCAL sprint when the issue has no sprint', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        jiraKey: 'FMS-1',
        status: 'TODO',
        sprint: { id: 3, source: 'LOCAL' }
      });
      await service.sync();
      expect(prisma.ticket.update.mock.calls[0][0].data).not.toHaveProperty(
        'sprintId'
      );
    });
    it('clears a JIRA sprint when the issue has no sprint', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        jiraKey: 'FMS-1',
        status: 'TODO',
        sprint: { id: 3, source: 'JIRA' }
      });
      await service.sync();
      expect(prisma.ticket.update.mock.calls[0][0].data.sprintId).toBeNull();
    });
    it('closes a refreshed sprint and moves unfinished LOCAL tickets', async () => {
      const open = {
        id: 70,
        jiraSprintId: 7,
        jiraBoardId: 4,
        state: 'ACTIVE',
        endDate: null,
        startDate: null
      };
      const next = { id: 71, state: 'ACTIVE', jiraBoardId: 4, startDate: null };
      prisma.sprint.findMany
        .mockResolvedValueOnce([open])
        .mockResolvedValueOnce([open])
        .mockResolvedValueOnce([next]);
      prisma.sprint.findUnique.mockResolvedValue(open);
      jira.getSprint.mockResolvedValue({ ...active, state: 'closed' });
      prisma.ticket.findMany.mockImplementation(
        async ({ where }: { where: { source: string } }) =>
          where.source === 'LOCAL' ? [{ projectId: 3 }, { projectId: 3 }] : []
      );
      await service.sync();
      expect(prisma.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 70 },
          data: expect.objectContaining({ state: 'CLOSED' })
        })
      );
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sprintId: 70, projectId: 3 }),
          data: { sprintId: 71 }
        })
      );
      expect(board.emitChanged).toHaveBeenCalledWith(3);
      expect(board.emitChanged).toHaveBeenCalledTimes(1);
    });
    it('rolls LOCAL tickets to an ACTIVE same-board sprint the project has no tickets in', async () => {
      const open = {
        id: 70,
        jiraSprintId: 7,
        jiraBoardId: 5,
        state: 'ACTIVE',
        endDate: null,
        startDate: null
      };
      const next = {
        id: 71,
        jiraSprintId: 8,
        state: 'ACTIVE',
        jiraBoardId: 5,
        startDate: null
      };
      prisma.sprint.findMany.mockImplementation(
        async ({ where }: { where: { tickets?: unknown } }) =>
          where.tickets
            ? []
            : prisma.sprint.update.mock.calls.length
              ? [next]
              : [open, next]
      );
      prisma.sprint.findUnique.mockResolvedValue(open);
      jira.getSprint.mockImplementation(async (id: number) => ({
        ...active,
        id,
        state: id === 7 ? 'closed' : 'active'
      }));
      prisma.ticket.findMany.mockImplementation(
        async ({ where }: { where: { source: string } }) =>
          where.source === 'LOCAL' ? [{ projectId: 3 }] : []
      );
      await service.sync();
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { sprintId: 71 } })
      );
    });
    it('warns once on 403 and treats an overdue ACTIVE sprint as CLOSED', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const open = {
        id: 70,
        jiraSprintId: 7,
        jiraBoardId: 4,
        state: 'ACTIVE',
        endDate: new Date('2020-01-01'),
        startDate: null
      };
      prisma.sprint.findMany.mockResolvedValue([open]);
      jira.getSprint.mockRejectedValue(new JiraHttpError(403));
      prisma.ticket.findMany.mockResolvedValue([]);
      await service.sync();
      await service.sync();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(prisma.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'CLOSED' })
        })
      );
      warn.mockRestore();
    });
    it('keeps a sprint the issue data just reported active when Agile access is denied', async () => {
      const past = '2020-01-01T00:00:00.000Z';
      const row = {
        id: 70,
        jiraSprintId: 7,
        jiraBoardId: 4,
        state: 'ACTIVE',
        endDate: new Date(past),
        startDate: null
      };
      jira.search.mockResolvedValue([
        { ...issue, sprints: [{ ...active, endDate: past }] }
      ]);
      prisma.sprint.findMany.mockResolvedValue([row]);
      jira.getSprint.mockRejectedValue(new JiraHttpError(403));
      await service.sync();
      expect(prisma.sprint.update).not.toHaveBeenCalled();
      expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    });
    it('emits board-changed once for a project whose ticket sprint changed', async () => {
      prisma.sprint.upsert.mockResolvedValue({ id: 70 });
      jira.search.mockResolvedValue([
        { ...issue, sprints: [active] },
        { ...issue, key: 'FMS-2', sprints: [active] }
      ]);
      prisma.ticket.findUnique.mockResolvedValue({
        source: 'JIRA',
        status: 'TODO',
        projectId: 3,
        sprintId: null,
        sprint: null
      });
      await service.sync();
      expect(board.emitChanged).toHaveBeenCalledTimes(1);
      expect(board.emitChanged).toHaveBeenCalledWith(3);
    });
    it('does no sprint work when the site has no sprint field', async () => {
      jira.sprintFieldId.mockResolvedValue(null);
      jira.search.mockResolvedValue([{ ...issue, sprints: [active] }]);
      const result = await service.sync();
      expect(prisma.sprint.upsert).not.toHaveBeenCalled();
      expect(jira.getSprint).not.toHaveBeenCalled();
      expect(result.sprints).toBe(0);
    });
  });
});
