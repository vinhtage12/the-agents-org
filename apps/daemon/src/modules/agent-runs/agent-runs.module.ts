import { Module } from '@nestjs/common';

import { AgentRunsController } from './controllers/agent-runs.controller';
import { AgentRunsService } from './services/agent-runs.service';

@Module({
  controllers: [AgentRunsController],
  providers: [AgentRunsService]
})
export class AgentRunsModule {}
