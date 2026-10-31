import { tmpdir } from 'node:os';

import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import {
  ProjectSettingsController,
  assertRepoPath
} from './project-settings.controller';

describe('ProjectSettingsController', () => {
  const prisma = {
    project: { findFirst: jest.fn(), update: jest.fn() },
    projectRepo: { create: jest.fn(), findFirst: jest.fn() }
  };
  const agents = { assertExists: jest.fn() };
  const controller = new ProjectSettingsController(
    prisma as unknown as PrismaService,
    agents as unknown as AgentProfilesService
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.project.findFirst.mockResolvedValue({
      id: 2,
      workspaceId: 1,
      defaultRepoId: null
    });
  });
  it('rejects relative or missing repo paths', async () => {
    await expect(assertRepoPath('repo/ff-web')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      assertRepoPath('/definitely/missing/dir')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(assertRepoPath(tmpdir())).resolves.toBeUndefined();
  });
  it('makes the first repo the default', async () => {
    prisma.projectRepo.create.mockResolvedValue({ id: 9 });
    await controller.createRepo(1, 2, { name: 'ff-web', path: tmpdir() });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { defaultRepoId: 9 }
    });
  });
  it('rejects a default repo from another project', async () => {
    prisma.projectRepo.findFirst.mockResolvedValue(null);
    await expect(
      controller.updateSettings(1, 2, { defaultRepoId: 77 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects unknown agent slugs', async () => {
    agents.assertExists.mockRejectedValue(
      new BadRequestException('Unknown agent: x')
    );
    await expect(
      controller.updateSettings(1, 2, { devAgent: 'x' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
