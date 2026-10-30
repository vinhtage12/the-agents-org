import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AgentProfilesController } from './agent-profiles/agent-profiles.controller';
import { AgentProfilesService } from './agent-profiles/agent-profiles.service';
import { AgentUsageService } from './agent-usage.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './configuration/env.validation';
import { HerdrClient } from './herdr/herdr.client';
import { HerdrController } from './herdr/herdr.controller';
import { HerdrGateway } from './herdr/herdr.gateway';
import { HerdrService } from './herdr/herdr.service';
import { JiraClient } from './jira/jira.client';
import { JiraSyncService } from './jira/jira-sync.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectSettingsController } from './project-settings.controller';
import { SystemController } from './system.controller';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { WorkspacesController } from './workspaces.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate
    }),
    PrismaModule
  ],
  controllers: [
    TicketsController,
    ProjectSettingsController,
    AgentProfilesController,
    AppController,
    HerdrController,
    WorkspacesController,
    SystemController
  ],
  providers: [
    TicketsService,
    JiraClient,
    JiraSyncService,
    AgentProfilesService,
    AgentUsageService,
    AppService,
    HerdrClient,
    HerdrService,
    HerdrGateway
  ]
})
export class AppModule {}
