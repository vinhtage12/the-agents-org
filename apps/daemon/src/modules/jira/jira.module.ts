import { Module } from '@nestjs/common';

import { JiraClient } from './clients/jira.client';
import { JiraSyncService } from './services/jira-sync.service';

@Module({
  providers: [JiraClient, JiraSyncService],
  exports: [JiraSyncService]
})
export class JiraModule {}
