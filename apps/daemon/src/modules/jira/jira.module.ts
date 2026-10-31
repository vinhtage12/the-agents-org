import { Module } from '@nestjs/common';

import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { JiraClient } from './clients/jira.client';
import { JiraSyncService } from './services/jira-sync.service';

@Module({
  imports: [AgentRunsModule],
  providers: [JiraClient, JiraSyncService],
  exports: [JiraSyncService]
})
export class JiraModule {}
