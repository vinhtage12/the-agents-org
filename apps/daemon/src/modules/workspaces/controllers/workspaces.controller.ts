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
import { CreateWorkspaceDto } from '../dtos/create-workspace.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';
import { UpdateWorkspaceDto } from '../dtos/update-workspace.dto';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.workspace.findMany({
      orderBy: { id: 'asc' },
      include: { projects: { orderBy: { id: 'asc' } } }
    });
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    if (id <= 0) throw new BadRequestException('ID must be positive');
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { projects: { orderBy: { id: 'asc' } } }
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  @Post()
  async create(@Body() data: CreateWorkspaceDto) {
    try {
      return await this.prisma.workspace.create({ data });
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post(':id/projects')
  async createProject(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Body() data: CreateWorkspaceDto
  ) {
    await this.detail(workspaceId);
    try {
      return await this.prisma.project.create({
        data: { ...data, workspaceId }
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get(':id/projects/:projectId')
  async project(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) id: number
  ) {
    if (id <= 0 || workspaceId <= 0)
      throw new BadRequestException('ID must be positive');
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId },
      include: { workspace: true }
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateWorkspaceDto
  ) {
    await this.detail(id);
    try {
      return await this.prisma.workspace.update({ where: { id }, data });
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.detail(id);
    try {
      await this.prisma.workspace.delete({ where: { id } });
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Patch(':id/projects/:projectId')
  async updateProject(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) id: number,
    @Body() data: UpdateProjectDto
  ) {
    await this.project(workspaceId, id);
    if (data.workspaceId !== undefined) await this.detail(data.workspaceId);
    try {
      return await this.prisma.project.update({
        where: { id, workspaceId },
        data
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete(':id/projects/:projectId')
  @HttpCode(204)
  async removeProject(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) id: number
  ) {
    await this.project(workspaceId, id);
    try {
      await this.prisma.project.delete({ where: { id, workspaceId } });
    } catch (error) {
      this.rethrow(error);
    }
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
