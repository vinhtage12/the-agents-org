import { Module } from '@nestjs/common';

import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { SprintsController } from './controllers/sprints.controller';
import { SprintsService } from './services/sprints.service';

@Module({
  imports: [AgentRunsModule],
  controllers: [SprintsController],
  providers: [SprintsService]
})
export class SprintsModule {}
