import { Module } from '@nestjs/common';

import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { JiraModule } from '../jira/jira.module';
import { TicketsController } from './controllers/tickets.controller';
import { TicketsService } from './services/tickets.service';

@Module({
  imports: [JiraModule, AgentRunsModule, AgentProfilesModule],
  controllers: [TicketsController],
  providers: [TicketsService]
})
export class TicketsModule {}
