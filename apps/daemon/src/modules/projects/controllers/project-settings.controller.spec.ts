import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { ProjectSettingsController } from './project-settings.controller';

describe('ProjectSettingsController', () => {
  const prisma = {
    project: { findFirst: jest.fn(), update: jest.fn() },
    repo: { count: jest.fn() }
  };
  const agents = { assertRole: jest.fn() };
  const controller = new ProjectSettingsController(
    prisma as unknown as PrismaService,
    agents as unknown as AgentProfilesService
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.project.findFirst.mockResolvedValue({
      id: 2,
      workspaceId: 1,
      defaultRepoId: null,
      repos: [],
      specAgentRef: null,
      devAgentRef: null,
      testAgentRef: null
    });
  });
  it('rejects a default repo that is not among repoIds', async () => {
    await expect(
      controller.updateSettings(1, 2, { repoIds: [1], defaultRepoId: 2 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
  it('rejects a QC agent as the spec agent', async () => {
    agents.assertRole.mockRejectedValue(new BadRequestException('role'));
    await expect(
      controller.updateSettings(1, 2, { specAgentId: 9 })
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
    await controller.updateSettings(1, 2, { repoIds: [3] });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { defaultRepoId: null, repos: { set: [{ id: 3 }] } }
    });
  });
});

describe('project spec-files', () => {
  let module: TestingModule;
  let controller: ProjectSettingsController;
  let dir: string;
  const prisma = { project: { findFirst: jest.fn() } };
  beforeEach(async () => {
    jest.resetAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'project-files-'));
    module = await Test.createTestingModule({
      controllers: [ProjectSettingsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: AgentProfilesService, useValue: {} }
      ]
    }).compile();
    controller = module.get(ProjectSettingsController);
  });
  afterEach(async () => {
    await module.close();
    await rm(dir, { recursive: true, force: true });
  });
  it('returns 409 for Jira projects', async () => {
    prisma.project.findFirst.mockResolvedValue({
      specSource: 'JIRA',
      specDir: null
    });
    await expect(controller.specFiles(1, 2)).rejects.toMatchObject({
      status: 409,
      message: 'Project does not use local specs'
    });
  });
  it.each([
    'LOCAL',
    'HYBRID'
  ])('returns labels for %s projects', async specSource => {
    prisma.project.findFirst.mockResolvedValue({ specSource, specDir: dir });
    await writeFile(join(dir, 'a.md'), 'spec');
    await expect(controller.specFiles(1, 2)).resolves.toEqual({
      data: [{ label: 'a.md' }]
    });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 2, workspaceId: 1 } })
    );
  });
  it('returns 404 when the project is outside the workspace', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(controller.specFiles(1, 2)).rejects.toMatchObject({
      status: 404
    });
  });
  it('returns 400 for a missing local directory', async () => {
    prisma.project.findFirst.mockResolvedValue({
      specSource: 'LOCAL',
      specDir: null
    });
    await expect(controller.specFiles(1, 2)).rejects.toMatchObject({
      status: 400
    });
  });
});
