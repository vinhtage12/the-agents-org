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

import { SaveRuleDto } from '../dtos/save-rule.dto';
import { UpdateRuleDto } from '../dtos/update-rule.dto';
import { RulesService } from '../services/rules.service';

@Controller('rules')
@ApiTags('rules')
export class RulesController {
  constructor(readonly service: RulesService) {}

  @Get()
  list(@Query('keyword') keyword?: string) {
    return this.service.list({ keyword });
  }

  @Post()
  create(@Body() dto: SaveRuleDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRuleDto) {
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
