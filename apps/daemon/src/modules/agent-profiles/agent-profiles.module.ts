import { Module } from '@nestjs/common';

import { AgentProfilesController } from './controllers/agent-profiles.controller';
import { AgentProfilesService } from './services/agent-profiles.service';

@Module({
  controllers: [AgentProfilesController],
  providers: [AgentProfilesService],
  exports: [AgentProfilesService]
})
export class AgentProfilesModule {}
