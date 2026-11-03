import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../database/prisma.service';
import { AgentImportService, rolesFor } from './agent-import.service';

describe('rolesFor', () => {
  it('infers one role per usage', () => {
    expect(rolesFor('dev-opus', { spec: [], dev: [1], test: [] })).toEqual([
      'DEV'
    ]);
    expect(rolesFor('x', { spec: [], dev: [], test: [] })).toEqual(['DEV']);
    expect(rolesFor('x', { spec: [1], dev: [], test: [2] })).toEqual([
      'BA',
      'QC'
    ]);
  });
});

describe('AgentImportService', () => {
  let agentsDir: string;
  let membersDir: string;
  const tx = {
    skill: { upsert: jest.fn() },
    agent: { create: jest.fn() },
    project: { updateMany: jest.fn() },
    ticket: { updateMany: jest.fn(), update: jest.fn() }
  };
  const prisma = {
    agent: { count: jest.fn() },
    project: { findMany: jest.fn() },
    ticket: { findMany: jest.fn() },
    $transaction: jest.fn()
  };
  let service: AgentImportService;

  beforeEach(async () => {
    jest.resetAllMocks();
    agentsDir = await mkdtemp(join(tmpdir(), 'legacy-agents-'));
    membersDir = await mkdtemp(join(tmpdir(), 'members-'));
    service = new AgentImportService(
      prisma as unknown as PrismaService,
      new ConfigService({ AGENTS_DIR: agentsDir, MEMBERS_DIR: membersDir })
    );
    prisma.agent.count.mockResolvedValue(0);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(fn => fn(tx));
    let id = 0;
    tx.agent.create.mockImplementation(() => Promise.resolve({ id: ++id }));
    tx.skill.upsert.mockImplementation(() => Promise.resolve({ id: 50 }));
    await writeFile(
      join(agentsDir, 'dev-opus.md'),
      '---\nname: Dev Opus\nprovider: codex\nskills: ponytail\n---\nBe careful.\n'
    );
  });

  afterEach(async () => {
    await rm(agentsDir, { recursive: true, force: true });
    await rm(membersDir, { recursive: true, force: true });
  });

  it('creates one agent per role and points references at it', async () => {
    prisma.project.findMany.mockResolvedValue([
      { specAgent: 'dev-opus', devAgent: 'dev-opus', testAgent: null }
    ]);
    const result = await service.importLegacy();
    expect(result).toEqual({ created: 2 });
    const names = tx.agent.create.mock.calls.map(c => c[0].data.name);
    expect(names).toEqual(['Dev Opus (BA)', 'Dev Opus (DEV)']);
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: { specAgent: 'dev-opus' },
      data: { specAgentId: 1 }
    });
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: { devAgent: 'dev-opus' },
      data: { devAgentId: 2 }
    });
  });

  it('writes AGENT.md once and keeps the original file', async () => {
    await service.importLegacy();
    const target = join(membersDir, 'dev-opus', 'AGENT.md');
    expect(await readFile(target, 'utf8')).toBe('Be careful.');
    await writeFile(target, 'edited');
    prisma.agent.count.mockResolvedValue(1);
    expect(await service.importLegacy()).toEqual({ created: 0 });
    expect(await readFile(target, 'utf8')).toBe('edited');
    await expect(stat(join(agentsDir, 'dev-opus.md'))).resolves.toBeDefined();
  });

  it('imports legacy skill names without a path', async () => {
    await service.importLegacy();
    expect(tx.skill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          name: 'ponytail',
          provider: 'codex',
          command: '$ponytail',
          path: '',
          description: 'Imported: set the skill folder path'
        }
      })
    );
  });

  it('turns ticket extraSkills into skills of the dev agent provider', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 7,
        specAgent: null,
        devAgent: 'dev-opus',
        testAgent: null,
        extraSkills: ['review']
      }
    ]);
    await service.importLegacy();
    expect(tx.skill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: 'review',
          provider: 'codex',
          command: '$review'
        })
      })
    );
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { skills: { connect: [{ id: 50 }] } }
    });
  });

  it('skips when the agents table is not empty', async () => {
    prisma.agent.count.mockResolvedValue(1);
    expect(await service.importLegacy()).toEqual({ created: 0 });
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });
});
