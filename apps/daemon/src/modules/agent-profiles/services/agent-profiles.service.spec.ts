import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException, ConflictException } from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';

import {
  AgentProfilesService,
  parseAgentProfile
} from './agent-profiles.service';

describe('parseAgentProfile', () => {
  it('parses frontmatter and body', () => {
    expect(
      parseAgentProfile(
        'fe-dev',
        '---\nname: Frontend Developer\nprovider: claude\nmodel: claude-sonnet-5-5\neffort: medium\nskills: a, b:c\n---\nBe careful.\n'
      )
    ).toEqual({
      slug: 'fe-dev',
      name: 'Frontend Developer',
      provider: 'claude',
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      skills: ['a', 'b:c'],
      instructions: 'Be careful.'
    });
  });
  it('normalizes antigravity to agy and defaults name to slug', () => {
    expect(
      parseAgentProfile('x', '---\nprovider: antigravity\n---\n')
    ).toMatchObject({ name: 'x', provider: 'agy', skills: [] });
  });
  it('rejects missing or unknown provider', () => {
    expect(() => parseAgentProfile('x', '---\nname: X\n---\n')).toThrow(
      'provider'
    );
    expect(() => parseAgentProfile('x', '---\nprovider: gpt\n---\n')).toThrow(
      'provider'
    );
  });
  it('rejects files without frontmatter', () => {
    expect(() => parseAgentProfile('x', 'hello')).toThrow('frontmatter');
  });
});

describe('AgentProfilesService', () => {
  const prisma = {
    agent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    project: { count: jest.fn() },
    ticket: { count: jest.fn() },
    scheduledTask: { count: jest.fn() },
    skill: { findMany: jest.fn() },
    rule: { findMany: jest.fn() }
  };
  const service = new AgentProfilesService(prisma as unknown as PrismaService);
  let dir: string;
  const body = (path: string, extra = {}) => ({
    name: 'Dev',
    role: 'DEV' as const,
    provider: 'claude',
    path,
    description: '',
    allowedTools: [],
    skillIds: [],
    ruleIds: [],
    ...extra
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'agent-dir-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('rejects an agent folder without AGENT.md', async () => {
    await expect(service.create(body(dir))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects skills of another provider', async () => {
    await writeFile(join(dir, 'AGENT.md'), 'x');
    prisma.skill.findMany.mockResolvedValue([{ id: 3, provider: 'codex' }]);
    await expect(
      service.create(body(dir, { skillIds: [3] }))
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });

  it('assertRole rejects a DEV agent for the spec step', async () => {
    prisma.agent.findUnique.mockResolvedValue({ id: 1, role: 'DEV' });
    await expect(service.assertRole(1, 'BA')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.assertRole(null, 'BA')).resolves.toBeUndefined();
  });

  it('remove rejects an agent used by a scheduled task', async () => {
    prisma.agent.findUnique.mockResolvedValue({ id: 1, role: 'DEV' });
    prisma.project.count.mockResolvedValue(0);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.scheduledTask.count.mockResolvedValue(1);

    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.agent.delete).not.toHaveBeenCalled();
  });

  it('includes scheduled tasks in the agent in-use count', async () => {
    prisma.agent.findMany.mockResolvedValue([
      {
        id: 1,
        _count: {
          projectsAsSpec: 0,
          projectsAsDev: 0,
          projectsAsTest: 0,
          ticketsAsSpec: 0,
          ticketsAsDev: 0,
          ticketsAsTest: 0,
          scheduledTasks: 2
        }
      }
    ]);
    expect(await service.list({})).toMatchObject({ data: [{ inUse: 2 }] });
    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: expect.objectContaining({ scheduledTasks: true }) }
        })
      })
    );
  });
});
