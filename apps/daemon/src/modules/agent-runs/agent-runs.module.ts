import { Module } from '@nestjs/common';

import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { HerdrModule } from '../herdr/herdr.module';
import { AgentRunsController } from './controllers/agent-runs.controller';
import { BoardGateway } from './gateways/board.gateway';
import { AgentRunsService } from './services/agent-runs.service';
import { TicketFlowService } from './services/ticket-flow.service';

@Module({
  imports: [HerdrModule, AgentProfilesModule],
  controllers: [AgentRunsController],
  providers: [AgentRunsService, TicketFlowService, BoardGateway],
  exports: [AgentRunsService, TicketFlowService, BoardGateway]
})
export class AgentRunsModule {}
