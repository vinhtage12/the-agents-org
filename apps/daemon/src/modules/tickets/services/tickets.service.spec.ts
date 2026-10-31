import { ConflictException } from '@nestjs/common';

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
  const service = new TicketsService(prisma as unknown as PrismaService);
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
  it('board sorts by linkedAt and returns only card fields', async () => {
    await service.board(3);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: { projectId: 3 },
      select: {
        id: true,
        jiraKey: true,
        summary: true,
        status: true,
        jiraUrl: true
      },
      orderBy: { linkedAt: 'asc' }
    });
  });
});
