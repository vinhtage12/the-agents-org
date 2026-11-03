import { BadRequestException } from '@nestjs/common';

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
