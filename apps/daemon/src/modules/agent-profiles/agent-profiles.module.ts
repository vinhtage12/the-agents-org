import { Module } from '@nestjs/common';

import { AgentProfilesController } from './controllers/agent-profiles.controller';
import { AgentImportService } from './services/agent-import.service';
import { AgentProfilesService } from './services/agent-profiles.service';

@Module({
  controllers: [AgentProfilesController],
  providers: [AgentProfilesService, AgentImportService],
  exports: [AgentProfilesService]
})
export class AgentProfilesModule {}
