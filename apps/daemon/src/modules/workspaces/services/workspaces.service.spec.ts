import { ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';

import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  const prisma = {
    workspace: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    }
  };
  const service = new WorkspacesService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('creates a workspace', async () => {
    prisma.workspace.create.mockResolvedValue({
      id: 1,
      name: 'Test',
      code: 'T'
    });
    await expect(service.create({ name: 'Test', code: 'T' })).resolves.toEqual({
      id: 1,
      name: 'Test',
      code: 'T'
    });
  });

  it('maps unique constraint failures to conflict', async () => {
    prisma.workspace.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create({ name: 'Test', code: 'T' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents deleting a nonempty workspace', async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: 1 });
    prisma.workspace.delete.mockRejectedValue({ code: 'P2003' });
    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a missing workspace', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(service.get(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
