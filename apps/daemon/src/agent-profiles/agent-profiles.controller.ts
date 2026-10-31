import { Controller, Get } from '@nestjs/common';

import { AgentProfilesService } from './agent-profiles.service';

@Controller('agent-profiles')
export class AgentProfilesController {
  constructor(private readonly profiles: AgentProfilesService) {}
  @Get()
  list() {
    return this.profiles.list();
  }
}
