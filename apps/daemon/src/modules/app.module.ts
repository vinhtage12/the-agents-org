import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validate } from '../configuration/env.validation';
import { PrismaModule } from '../database/prisma.module';
import { AgentProfilesModule } from './agent-profiles/agent-profiles.module';
import { AgentUsageModule } from './agent-usage/agent-usage.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HerdrModule } from './herdr/herdr.module';
import { JiraModule } from './jira/jira.module';
import { ProjectsModule } from './projects/projects.module';
import { SystemModule } from './system/system.module';
import { TicketsModule } from './tickets/tickets.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate
    }),
    PrismaModule,
    AgentProfilesModule,
    AgentUsageModule,
    HerdrModule,
    JiraModule,
    TicketsModule,
    WorkspacesModule,
    ProjectsModule,
    SystemModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
