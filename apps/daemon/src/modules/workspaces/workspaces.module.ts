import { Module } from '@nestjs/common';

import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesController } from './controllers/workspaces.controller';
import { WorkspacesService } from './services/workspaces.service';

@Module({
  imports: [ProjectsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService]
})
export class WorkspacesModule {}
