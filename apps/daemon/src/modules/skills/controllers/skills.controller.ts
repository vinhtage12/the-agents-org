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

import { SaveSkillDto } from '../dtos/save-skill.dto';
import { UpdateSkillDto } from '../dtos/update-skill.dto';
import { SkillsService } from '../services/skills.service';

@Controller('skills')
@ApiTags('skills')
export class SkillsController {
  constructor(readonly service: SkillsService) {}

  @Get()
  list(
    @Query('keyword') keyword?: string,
    @Query('provider') provider?: string
  ) {
    return this.service.list({ keyword, provider });
  }

  @Post()
  create(@Body() dto: SaveSkillDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSkillDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Get(':id/usage')
  usage(@Param('id', ParseIntPipe) id: number) {
    return this.service.usage(id);
  }
}
