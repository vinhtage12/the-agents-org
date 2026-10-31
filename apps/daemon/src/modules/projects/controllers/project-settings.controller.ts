import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { AgentProfilesService } from '../../agent-profiles/services/agent-profiles.service';
import { CreateRepoDto } from '../dtos/create-repo.dto';
import { UpdateProjectSettingsDto } from '../dtos/update-project-settings.dto';
import { UpdateRepoDto } from '../dtos/update-repo.dto';

export async function assertRepoPath(path: string): Promise<void> {
  if (isAbsolute(path)) {
    try {
      if ((await stat(path)).isDirectory()) return;
    } catch {
      /* Invalid path. */
    }
  }
  throw new BadRequestException(
    'Repo path must be an absolute existing directory'
  );
}
@Controller('workspaces/:id/projects/:projectId')
export class ProjectSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentProfiles: AgentProfilesService
  ) {}
  private async project(workspaceId: number, id: number) {
    if (workspaceId <= 0 || id <= 0)
      throw new BadRequestException('ID must be positive');
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId }
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
  @Get('settings')
  async settings(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number
  ) {
    const project = await this.project(workspaceId, projectId);
    const repos = await this.prisma.projectRepo.findMany({
      where: { projectId },
      orderBy: { id: 'asc' }
    });
    return {
      repos,
      defaultRepoId: project.defaultRepoId,
      specAgent: project.specAgent,
      devAgent: project.devAgent,
      testAgent: project.testAgent
    };
  }
  @Post('repos')
  async createRepo(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: CreateRepoDto
  ) {
    const project = await this.project(workspaceId, projectId);
    await assertRepoPath(data.path);
    try {
      const repo = await this.prisma.projectRepo.create({
        data: { ...data, projectId }
      });
      if (project.defaultRepoId === null)
        await this.prisma.project.update({
          where: { id: projectId },
          data: { defaultRepoId: repo.id }
        });
      return repo;
    } catch (error) {
      this.rethrow(error);
    }
  }
  private async repo(workspaceId: number, projectId: number, id: number) {
    await this.project(workspaceId, projectId);
    const repo = await this.prisma.projectRepo.findFirst({
      where: { id, projectId }
    });
    if (!repo) throw new NotFoundException('Repo not found');
    return repo;
  }
  @Patch('repos/:repoId')
  async updateRepo(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('repoId', ParseIntPipe) id: number,
    @Body() data: UpdateRepoDto
  ) {
    await this.repo(workspaceId, projectId, id);
    if (data.path !== undefined) await assertRepoPath(data.path);
    try {
      return await this.prisma.projectRepo.update({ where: { id }, data });
    } catch (error) {
      this.rethrow(error);
    }
  }
  @Delete('repos/:repoId')
  @HttpCode(204)
  async deleteRepo(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('repoId', ParseIntPipe) id: number
  ) {
    await this.repo(workspaceId, projectId, id);
    await this.prisma.projectRepo.delete({ where: { id } });
  }
  @Patch('settings')
  async updateSettings(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: UpdateProjectSettingsDto
  ) {
    await this.project(workspaceId, projectId);
    if (
      data.defaultRepoId != null &&
      !(await this.prisma.projectRepo.findFirst({
        where: { id: data.defaultRepoId, projectId }
      }))
    )
      throw new BadRequestException('Default repo must belong to this project');
    await this.agentProfiles.assertExists([
      data.specAgent,
      data.devAgent,
      data.testAgent
    ]);
    await this.prisma.project.update({ where: { id: projectId }, data });
    return this.settings(workspaceId, projectId);
  }
  private rethrow(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    )
      throw new ConflictException('Repo name already exists');
    throw error;
  }
}
