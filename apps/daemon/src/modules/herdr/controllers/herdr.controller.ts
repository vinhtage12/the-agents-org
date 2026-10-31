import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateAgentDto } from '../dtos/create-agent.dto';
import { SendAgentPromptDto } from '../dtos/send-agent-prompt.dto';
import { HerdrService } from '../services/herdr.service';

@Controller('agents')
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

  @Post(':id/prompts')
  sendPrompt(@Param('id') id: string, @Body() body: SendAgentPromptDto) {
    return this.herdr.sendPrompt(id, body.prompt);
  }
}
