import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { UpdateProjectSettingsDto } from '../dtos/update-project-settings.dto';
import { ProjectsService } from '../services/projects.service';

@Controller('workspaces/:id/projects/:projectId')
@ApiTags('projects')
export class ProjectSettingsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('spec-files')
  specFiles(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number
  ): Promise<{ data: { label: string }[] }> {
    return this.projects.specFiles(workspaceId, projectId);
  }

  @Get('settings')
  settings(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number
  ) {
    return this.projects.settings(workspaceId, projectId);
  }

  @Patch('settings')
  updateSettings(
    @Param('id', ParseIntPipe) workspaceId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: UpdateProjectSettingsDto
  ) {
    return this.projects.updateSettings(workspaceId, projectId, data);
  }
}
