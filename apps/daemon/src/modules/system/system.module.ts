import { Module } from '@nestjs/common';

import { AgentUsageModule } from '../agent-usage/agent-usage.module';
import { SystemController } from './controllers/system.controller';

@Module({
  imports: [AgentUsageModule],
  controllers: [SystemController]
})
export class SystemModule {}
