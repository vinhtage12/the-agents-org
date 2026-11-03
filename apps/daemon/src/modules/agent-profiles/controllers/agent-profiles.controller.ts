import { createReadStream } from 'node:fs';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SaveAgentDto } from '../dtos/save-agent.dto';
import { UpdateAgentDto } from '../dtos/update-agent.dto';
import { AgentRole } from '../entities/agent.entity';
import { AgentProfilesService } from '../services/agent-profiles.service';

@Controller('agent-profiles')
@ApiTags('agent-profiles')
export class AgentProfilesController {
  constructor(private readonly profiles: AgentProfilesService) {}

  @Get()
  list(
    @Query('keyword') keyword?: string,
    @Query('role', new ParseEnumPipe(AgentRole, { optional: true }))
    role?: AgentRole
  ) {
    return this.profiles.list({ keyword, role });
  }

  @Post()
  create(@Body() dto: SaveAgentDto) {
    return this.profiles.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.profiles.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgentDto) {
    return this.profiles.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.profiles.remove(id);
  }

  @Get(':id/usage')
  usage(@Param('id', ParseIntPipe) id: number) {
    return this.profiles.usage(id);
  }

  // GET is exempt from the client-header guard, so <img> can load it.
  @Get(':id/avatar')
  async avatar(@Param('id', ParseIntPipe) id: number) {
    return new StreamableFile(
      createReadStream(await this.profiles.avatarPath(id)),
      {
        type: 'image/png'
      }
    );
  }
}
