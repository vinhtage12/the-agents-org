import { Module } from '@nestjs/common';

import { AgentUsageService } from './services/agent-usage.service';

@Module({
  providers: [AgentUsageService],
  exports: [AgentUsageService]
})
export class AgentUsageModule {}
