import { Module } from '@nestjs/common';

import { WorkspacesController } from './controllers/workspaces.controller';

@Module({
  controllers: [WorkspacesController]
})
export class WorkspacesModule {}
