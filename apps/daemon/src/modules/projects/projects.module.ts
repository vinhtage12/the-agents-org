import { Module } from '@nestjs/common';

import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { ProjectSettingsController } from './controllers/project-settings.controller';
import { ProjectsService } from './services/projects.service';

@Module({
  imports: [AgentProfilesModule],
  controllers: [ProjectSettingsController],
  providers: [ProjectsService],
  exports: [ProjectsService]
})
export class ProjectsModule {}
