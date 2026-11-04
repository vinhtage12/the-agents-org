import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SaveScheduledTaskDto } from '../dtos/save-scheduled-task.dto';
import { UpdateScheduledTaskDto } from '../dtos/update-scheduled-task.dto';
import { ScheduledRunnerService } from '../services/scheduled-runner.service';
import { ScheduledTasksService } from '../services/scheduled-tasks.service';

@Controller('scheduled-tasks')
@ApiTags('scheduled-tasks')
export class ScheduledTasksController {
  constructor(
    readonly service: ScheduledTasksService,
    private readonly runner: ScheduledRunnerService
  ) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: SaveScheduledTaskDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduledTaskDto
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/run') run(@Param('id', ParseIntPipe) id: number) {
    return this.runner.start(id, 'MANUAL', new Date());
  }

  @Get(':id/runs') runs(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = '1'
  ) {
    return this.runner.runs(id, Math.max(1, Number(page) || 1));
  }
}
