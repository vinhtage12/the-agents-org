import { Module } from '@nestjs/common';

import { AgentUsageModule } from '../agent-usage/agent-usage.module';
import { SystemController } from './controllers/system.controller';
import { SystemService } from './services/system.service';

@Module({
  imports: [AgentUsageModule],
  controllers: [SystemController],
  providers: [SystemService]
})
export class SystemModule {}
