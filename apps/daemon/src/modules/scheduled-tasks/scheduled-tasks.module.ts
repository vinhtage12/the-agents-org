import { Module } from '@nestjs/common';

import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { HerdrModule } from '../herdr/herdr.module';
import { ScheduledRunsController } from './controllers/scheduled-runs.controller';
import { ScheduledTasksController } from './controllers/scheduled-tasks.controller';
import { ScheduledRunnerService } from './services/scheduled-runner.service';
import { ScheduledTasksService } from './services/scheduled-tasks.service';
import { SchedulerService } from './services/scheduler.service';

@Module({
  imports: [AgentProfilesModule, HerdrModule],
  controllers: [ScheduledTasksController, ScheduledRunsController],
  providers: [ScheduledTasksService, ScheduledRunnerService, SchedulerService]
})
export class ScheduledTasksModule {}
