import { Module } from '@nestjs/common';

import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { HerdrModule } from '../herdr/herdr.module';
import { AgentRunsController } from './controllers/agent-runs.controller';
import { BoardGateway } from './gateways/board.gateway';
import { AgentRunsService } from './services/agent-runs.service';

@Module({
  imports: [HerdrModule, AgentProfilesModule],
  controllers: [AgentRunsController],
  providers: [AgentRunsService, BoardGateway],
  exports: [AgentRunsService, BoardGateway]
})
export class AgentRunsModule {}
