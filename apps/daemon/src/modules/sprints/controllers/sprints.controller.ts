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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CompleteSprintDto } from '../dtos/complete-sprint.dto';
import { CreateSprintDto } from '../dtos/create-sprint.dto';
import { UpdateSprintDto } from '../dtos/update-sprint.dto';
import { SprintEntity } from '../entities/sprint.entity';
import { SprintsService } from '../services/sprints.service';

@Controller()
@ApiTags('sprints')
export class SprintsController {
  constructor(readonly service: SprintsService) {}

  @Get('projects/:projectId/sprints')
  @ApiOkResponse({ type: SprintEntity, isArray: true })
  list(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.list(projectId);
  }

  @Post('projects/:projectId/sprints')
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: CreateSprintDto
  ) {
    return this.service.create(projectId, body);
  }

  @Patch('sprints/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSprintDto) {
    return this.service.update(id, body);
  }

  @Delete('sprints/:id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post('sprints/:id/start')
  start(@Param('id', ParseIntPipe) id: number) {
    return this.service.start(id);
  }

  @Post('sprints/:id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CompleteSprintDto
  ) {
    return this.service.complete(id, body.target);
  }
}
