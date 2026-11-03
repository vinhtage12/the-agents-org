import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  const prisma = {
    workspace: { findUnique: jest.fn() },
    project: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    repo: { count: jest.fn() }
  };
  const agents = { assertRole: jest.fn() };
  const service = new ProjectsService(
    prisma as unknown as PrismaService,
    agents as unknown as AgentProfilesService
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workspace.findUnique.mockResolvedValue({ id: 1 });
    prisma.project.findFirst.mockResolvedValue({
      id: 2,
      workspaceId: 1,
      defaultRepoId: null,
      repos: [],
      specAgentRef: null,
      devAgentRef: null,
      testAgentRef: null,
      specSource: 'JIRA',
      specDir: null
    });
  });

  it('rejects projects in missing workspaces', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(
      service.create(1, { name: 'Test', code: 'T' })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('scopes project lookup to its workspace', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(service.get(1, 2)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 2, workspaceId: 1 },
      include: { workspace: true }
    });
  });

  it('does not move a project into a missing target workspace', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 2, workspaceId: 1 });
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(
      service.update(1, 2, { workspaceId: 3 })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('scopes updates atomically to the original workspace', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 2, workspaceId: 1 });
    prisma.workspace.findUnique.mockResolvedValue({ id: 3 });
    prisma.project.update.mockRejectedValue({ code: 'P2025' });
    await expect(
      service.update(1, 2, { workspaceId: 3 })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 2, workspaceId: 1 },
      data: { workspaceId: 3 }
    });
  });

  it('rejects a default repo that is not among repoIds', async () => {
    await expect(
      service.updateSettings(1, 2, { repoIds: [1], defaultRepoId: 2 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('rejects a QC agent as the spec agent', async () => {
    agents.assertRole.mockRejectedValue(new BadRequestException('role'));
    await expect(
      service.updateSettings(1, 2, { specAgentId: 9 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('sets repos and clears an unlinked default', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 2,
      workspaceId: 1,
      defaultRepoId: 1,
      repos: [{ id: 1 }],
      specAgentRef: null,
      devAgentRef: null,
      testAgentRef: null
    });
    prisma.repo.count.mockResolvedValue(1);
    await service.updateSettings(1, 2, { repoIds: [3] });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { defaultRepoId: null, repos: { set: [{ id: 3 }] } }
    });
  });

  it('maps duplicate project codes to conflict', async () => {
    prisma.project.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create(1, { name: 'Test', code: 'T' })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ProjectsService spec files', () => {
  let dir: string;
  const prisma = {
    workspace: { findUnique: jest.fn() },
    project: { findFirst: jest.fn() },
    repo: { count: jest.fn() }
  };
  const service = new ProjectsService(
    prisma as unknown as PrismaService,
    { assertRole: jest.fn() } as unknown as AgentProfilesService
  );

  beforeEach(async () => {
    jest.resetAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'project-files-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns 409 for Jira projects', async () => {
    prisma.project.findFirst.mockResolvedValue({
      specSource: 'JIRA',
      specDir: null
    });
    await expect(service.specFiles(1, 2)).rejects.toMatchObject({
      status: 409
    });
  });

  it.each([
    'LOCAL',
    'HYBRID'
  ])('returns labels for %s projects', async specSource => {
    prisma.project.findFirst.mockResolvedValue({ specSource, specDir: dir });
    await writeFile(join(dir, 'a.md'), 'spec');
    await expect(service.specFiles(1, 2)).resolves.toEqual({
      data: [{ label: 'a.md' }]
    });
  });

  it('returns 404 when the project is outside the workspace', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(service.specFiles(1, 2)).rejects.toMatchObject({
      status: 404
    });
  });
});
