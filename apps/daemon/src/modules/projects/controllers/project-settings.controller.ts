import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { assertRepoPath } from '../../repositories/utils/repo-path';
import { UpdateProjectSettingsDto } from '../dtos/update-project-settings.dto';
import { listSpecFiles } from '../utils/spec-files';

export { assertRepoPath } from '../../repositories/utils/repo-path';

const AGENT_REF = {
  select: { id: true, name: true, role: true, provider: true, model: true }
} as const;

@Controller('workspaces/:id/projects/:projectId')
@ApiTags('projects')
export class ProjectSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentProfiles: AgentProfilesService
  ) {}

  private async project(workspaceId: number, id: number) {
    if (workspaceId <= 0 || id <= 0)
      throw new BadRequestException('ID must be positive');
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId },
      include: {
        repos: { orderBy: { id: 'asc' } },
        specAgentRef: AGENT_REF,
        devAgentRef: AGENT_REF,
        testAgentRef: AGENT_REF
      }
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  @Get('spec-files')
  async specFiles(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number
  ): Promise<{ data: { label: string }[] }> {
    const project = await this.project(workspaceId, projectId);
    if (project.specSource === 'JIRA') {
      throw new ConflictException('Project does not use local specs');
    }
    const dir = project.specDir ?? '';
    await assertRepoPath(dir, 'Spec directory');
    const files = await listSpecFiles(dir);
    return { data: files.map(label => ({ label })) };
  }

  @Get('settings')
  async settings(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number
  ) {
    const project = await this.project(workspaceId, projectId);
    return {
      repos: project.repos,
      defaultRepoId: project.defaultRepoId,
      specAgent: project.specAgentRef,
      devAgent: project.devAgentRef,
      testAgent: project.testAgentRef
    };
  }

  @Patch('settings')
  async updateSettings(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: UpdateProjectSettingsDto
  ) {
    const project = await this.project(workspaceId, projectId);
    const { repoIds, ...rest } = data;
    const effective = repoIds ?? project.repos.map(r => r.id);
    const defaultRepoId =
      rest.defaultRepoId === undefined
        ? project.defaultRepoId
        : rest.defaultRepoId;
    if (defaultRepoId != null && !effective.includes(defaultRepoId)) {
      if (rest.defaultRepoId != null)
        throw new BadRequestException(
          'Default repo must be one of the project repos'
        );
      rest.defaultRepoId = null; // the old default was just unlinked
    }
    if (repoIds) {
      const found = await this.prisma.repo.count({
        where: { id: { in: repoIds } }
      });
      if (found !== new Set(repoIds).size)
        throw new BadRequestException('Unknown repo');
    }
    await this.agentProfiles.assertRole(rest.specAgentId, 'BA');
    await this.agentProfiles.assertRole(rest.devAgentId, 'DEV');
    await this.agentProfiles.assertRole(rest.testAgentId, 'QC');
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        ...(repoIds && { repos: { set: repoIds.map(id => ({ id })) } })
      }
    });
    return this.settings(workspaceId, projectId);
  }
}
