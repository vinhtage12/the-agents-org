import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AgentProfilesService } from '../services/agent-profiles.service';

@Controller('agent-profiles')
@ApiTags('agent-profiles')
export class AgentProfilesController {
  constructor(private readonly profiles: AgentProfilesService) {}
  @Get()
  list() {
    return this.profiles.list();
  }
}
