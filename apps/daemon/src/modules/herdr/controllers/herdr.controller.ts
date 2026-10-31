import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateAgentDto } from '../dtos/create-agent.dto';
import { SendAgentPromptDto } from '../dtos/send-agent-prompt.dto';
import { HerdrService } from '../services/herdr.service';

@Controller('agents')
@ApiTags('herdr')
export class HerdrController {
  constructor(private readonly herdr: HerdrService) {}

  @Get()
  listAgents() {
    return this.herdr.listAgents();
  }

  @Post()
  createAgent(@Body() body: CreateAgentDto) {
    return this.herdr.createAgent(body);
  }

  @Get(':id')
  getAgent(@Param('id') id: string) {
    return this.herdr.getAgent(id);
  }

  @Get(':id/output')
  async readAgent(
    @Param('id') id: string,
    @Query('lines', new DefaultValuePipe(200), ParseIntPipe) lines: number
  ) {
    if (lines < 1 || lines > 1000) {
      throw new BadRequestException('lines must be between 1 and 1000');
    }
    return { text: await this.herdr.readAgent(id, lines) };
  }

  @Post(':id/prompts')
  sendPrompt(@Param('id') id: string, @Body() body: SendAgentPromptDto) {
    return this.herdr.sendPrompt(id, body.prompt);
  }
}
