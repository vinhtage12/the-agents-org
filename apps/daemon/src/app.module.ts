import { ProjectSettingsController } from './project-settings.controller';
import { AgentProfilesService } from './agent-profiles/agent-profiles.service';
import { AgentProfilesController } from './agent-profiles/agent-profiles.controller';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AgentUsageService } from './agent-usage.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './configuration/env.validation';
import { HerdrClient } from './herdr/herdr.client';
import { HerdrController } from './herdr/herdr.controller';
import { HerdrGateway } from './herdr/herdr.gateway';
import { HerdrService } from './herdr/herdr.service';
import { PrismaModule } from './prisma/prisma.module';
import { SystemController } from './system.controller';
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
    ProjectSettingsController,
    AgentProfilesController,
    AppController,
    HerdrController,
    WorkspacesController,
    SystemController
  ],
  providers: [
    AgentProfilesService,
    AgentUsageService,
    AppService,
    HerdrClient,
    HerdrService,
    HerdrGateway
  ]
})
export class AppModule {}
