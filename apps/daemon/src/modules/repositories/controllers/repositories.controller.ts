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

import { CreateRepoDto } from '../dtos/create-repo.dto';
import { SaveEnvironmentDto } from '../dtos/save-environment.dto';
import { UpdateRepoDto } from '../dtos/update-repo.dto';
import { RepositoriesService } from '../services/repositories.service';

@Controller('repositories')
@ApiTags('repositories')
export class RepositoriesController {
  constructor(readonly service: RepositoriesService) {}

  @Get()
  list(@Query('keyword') keyword?: string) {
    return this.service.list(keyword);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateRepoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRepoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/environments')
  createEnvironment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveEnvironmentDto
  ) {
    return this.service.createEnvironment(id, dto);
  }

  @Patch(':id/environments/:envId')
  updateEnvironment(
    @Param('id', ParseIntPipe) id: number,
    @Param('envId', ParseIntPipe) envId: number,
    @Body() dto: SaveEnvironmentDto
  ) {
    return this.service.updateEnvironment(id, envId, dto);
  }

  @Delete(':id/environments/:envId')
  @HttpCode(204)
  removeEnvironment(
    @Param('id', ParseIntPipe) id: number,
    @Param('envId', ParseIntPipe) envId: number
  ) {
    return this.service.removeEnvironment(id, envId);
  }

  @Get(':id/git-branches')
  gitBranches(
    @Param('id', ParseIntPipe) id: number,
    @Query('keyword') keyword?: string
  ) {
    return this.service.gitBranches(id, keyword);
  }

  @Get(':id/usage')
  usage(@Param('id', ParseIntPipe) id: number) {
    return this.service.usage(id);
  }
}
