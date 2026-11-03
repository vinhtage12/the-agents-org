import { tmpdir } from 'node:os';

import { BadRequestException, ConflictException } from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';
import { RulesService } from './rules.service';

describe('RulesService', () => {
  const prisma = {
    rule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    agent: { count: jest.fn() },
    ticket: { count: jest.fn() }
  };
  const service = new RulesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.rule.findUnique.mockResolvedValue({ id: 1 });
  });

  it('rejects a rule path that is a directory', async () => {
    await expect(
      service.create({ name: 'r', path: tmpdir(), description: '' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks deleting a rule used by an open ticket', async () => {
    prisma.agent.count.mockResolvedValue(0);
    prisma.ticket.count.mockResolvedValue(1);
    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });
});
