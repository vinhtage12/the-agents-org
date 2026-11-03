import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { assertRepoPath } from '../../repositories/utils/repo-path';
import { CreateProjectDto } from '../../workspaces/dtos/create-project.dto';
import { UpdateProjectDto } from '../../workspaces/dtos/update-project.dto';
import { ProjectEntity } from '../../workspaces/entities/project.entity';
import { normalizeSpecSettings } from '../../workspaces/utils/spec-settings';
import { UpdateProjectSettingsDto } from '../dtos/update-project-settings.dto';
import { listSpecFiles } from '../utils/spec-files';

const AGENT_REF = {
  select: { id: true, name: true, role: true, provider: true, model: true }
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentProfiles: AgentProfilesService
  ) {}

  async create(
    workspaceId: number,
    data: CreateProjectDto
  ): Promise<ProjectEntity> {
    await this.workspace(workspaceId);
    const spec = await normalizeSpecSettings(data);
    try {
      return await this.prisma.project.create({
        data: { ...data, ...spec, workspaceId }
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async get(workspaceId: number, id: number) {
    if (id <= 0 || workspaceId <= 0)
      throw new BadRequestException('ID must be positive');
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId },
      include: { workspace: true }
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(
    workspaceId: number,
    id: number,
    data: UpdateProjectDto
  ): Promise<ProjectEntity> {
    const project = await this.get(workspaceId, id);
    const spec = await normalizeSpecSettings(data, project);
    if (data.workspaceId !== undefined) await this.workspace(data.workspaceId);
    try {
      return await this.prisma.project.update({
        where: { id, workspaceId },
        data: { ...data, ...spec }
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async remove(workspaceId: number, id: number): Promise<void> {
    await this.get(workspaceId, id);
    try {
      await this.prisma.project.delete({ where: { id, workspaceId } });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async specFiles(
    workspaceId: number,
    projectId: number
  ): Promise<{ data: { label: string }[] }> {
    const project = await this.settingsProject(workspaceId, projectId);
    if (project.specSource === 'JIRA')
      throw new ConflictException('Project does not use local specs');
    const dir = project.specDir ?? '';
    await assertRepoPath(dir, 'Spec directory');
    const files = await listSpecFiles(dir);
    return { data: files.map(label => ({ label })) };
  }

  async settings(workspaceId: number, projectId: number) {
    const project = await this.settingsProject(workspaceId, projectId);
    return {
      repos: project.repos,
      defaultRepoId: project.defaultRepoId,
      specAgent: project.specAgentRef,
      devAgent: project.devAgentRef,
      testAgent: project.testAgentRef
    };
  }

  async updateSettings(
    workspaceId: number,
    projectId: number,
    data: UpdateProjectSettingsDto
  ) {
    const project = await this.settingsProject(workspaceId, projectId);
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
      rest.defaultRepoId = null;
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

  private async workspace(id: number) {
    if (id <= 0) throw new BadRequestException('ID must be positive');
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  private async settingsProject(workspaceId: number, id: number) {
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

  private rethrow(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    )
      throw new ConflictException('Code already exists');
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2003')
        throw new ConflictException(
          'Workspace still contains projects or target workspace no longer exists'
        );
      if (error.code === 'P2025')
        throw new NotFoundException('Workspace or project not found');
    }
    throw error;
  }
}
