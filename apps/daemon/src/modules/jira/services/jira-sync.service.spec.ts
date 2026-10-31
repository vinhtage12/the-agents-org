import { ServiceUnavailableException } from '@nestjs/common';

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
    assigneeAccountId: 'me'
  };
  const jira = {
    isConfigured: jest.fn(),
    myself: jest.fn(),
    search: jest.fn(),
    getIssue: jest.fn(),
    browseUrl: jest.fn()
  };
  const prisma = {
    ticket: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };
  const service = new JiraSyncService(
    jira as unknown as JiraClient,
    prisma as unknown as PrismaService
  );
  beforeEach(() => {
    jest.resetAllMocks();
    jira.isConfigured.mockReturnValue(true);
    jira.myself.mockResolvedValue({ accountId: 'me' });
    jira.search.mockResolvedValue([issue]);
    jira.browseUrl.mockReturnValue('https://jira/browse/FMS-1');
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.findUnique.mockResolvedValue(null);
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
});
