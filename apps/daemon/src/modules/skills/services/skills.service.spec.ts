import { tmpdir } from 'node:os';

import { BadRequestException, ConflictException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  const prisma = {
    skill: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    agent: { count: jest.fn() },
    ticket: { count: jest.fn() }
  };
  const service = new SkillsService(prisma as unknown as PrismaService);
  const body = {
    name: 'a',
    provider: 'codex',
    command: '$a',
    description: ''
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.skill.findUnique.mockResolvedValue({ id: 1 });
  });

  it('rejects a relative skill path', async () => {
    await expect(
      service.create({ ...body, path: 'skills/a' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks deleting a skill used by an agent', async () => {
    prisma.agent.count.mockResolvedValue(1);
    prisma.ticket.count.mockResolvedValue(0);
    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.skill.delete).not.toHaveBeenCalled();
  });

  it('filters skills by provider and keyword', async () => {
    prisma.skill.findMany.mockResolvedValue([]);
    await service.list({ provider: 'codex', keyword: 'test' });
    expect(prisma.skill.findMany.mock.calls[0][0].where).toEqual({
      provider: 'codex',
      name: { contains: 'test', mode: 'insensitive' }
    });
  });

  it('accepts an absolute directory', async () => {
    prisma.skill.create.mockResolvedValue({ id: 2 });
    await service.create({ ...body, path: tmpdir() });
    expect(prisma.skill.create).toHaveBeenCalled();
  });
});
