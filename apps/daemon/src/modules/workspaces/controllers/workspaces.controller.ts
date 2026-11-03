import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ProjectsService } from '#modules/projects/services/projects.service';

import { CreateProjectDto } from '../dtos/create-project.dto';
import { CreateWorkspaceDto } from '../dtos/create-workspace.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';
import { UpdateWorkspaceDto } from '../dtos/update-workspace.dto';
import { ProjectEntity } from '../entities/project.entity';
import { WorkspaceEntity } from '../entities/workspace.entity';
import { WorkspacesService } from '../services/workspaces.service';

@Controller('workspaces')
@ApiTags('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly projects: ProjectsService
  ) {}

  @Get()
  @ApiOkResponse({ type: WorkspaceEntity, isArray: true })
  list(): Promise<(WorkspaceEntity & { projects: ProjectEntity[] })[]> {
    return this.workspaces.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: WorkspaceEntity })
  detail(
    @Param('id', ParseIntPipe) id: number
  ): Promise<WorkspaceEntity & { projects: ProjectEntity[] }> {
    return this.workspaces.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: WorkspaceEntity })
  create(@Body() data: CreateWorkspaceDto): Promise<WorkspaceEntity> {
    return this.workspaces.create(data);
  }

  @Post(':id/projects')
  @ApiCreatedResponse({ type: ProjectEntity })
  createProject(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Body() data: CreateProjectDto
  ): Promise<ProjectEntity> {
    return this.projects.create(workspaceId, data);
  }

  @Get(':id/projects/:projectId')
  @ApiOkResponse({ type: ProjectEntity })
  project(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) id: number
  ) {
    return this.projects.get(workspaceId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: WorkspaceEntity })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateWorkspaceDto
  ): Promise<WorkspaceEntity> {
    return this.workspaces.update(id, data);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.workspaces.remove(id);
  }

  @Patch(':id/projects/:projectId')
  @ApiOkResponse({ type: ProjectEntity })
  updateProject(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) id: number,
    @Body() data: UpdateProjectDto
  ): Promise<ProjectEntity> {
    return this.projects.update(workspaceId, id, data);
  }

  @Delete(':id/projects/:projectId')
  @HttpCode(204)
  removeProject(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) id: number
  ) {
    return this.projects.remove(workspaceId, id);
  }
}
