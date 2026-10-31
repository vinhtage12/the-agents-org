import { Module } from '@nestjs/common';

import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { ProjectSettingsController } from './controllers/project-settings.controller';

@Module({
  imports: [AgentProfilesModule],
  controllers: [ProjectSettingsController]
})
export class ProjectsModule {}
