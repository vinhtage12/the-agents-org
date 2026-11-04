import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validate } from '../configuration/env.validation';
import { PrismaModule } from '../database/prisma.module';
import { AgentProfilesModule } from './agent-profiles/agent-profiles.module';
import { AgentRunsModule } from './agent-runs/agent-runs.module';
import { AgentUsageModule } from './agent-usage/agent-usage.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GitModule } from './git/git.module';
import { HerdrModule } from './herdr/herdr.module';
import { JiraModule } from './jira/jira.module';
import { ProjectsModule } from './projects/projects.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { RulesModule } from './rules/rules.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { SkillsModule } from './skills/skills.module';
import { SprintsModule } from './sprints/sprints.module';
import { SystemModule } from './system/system.module';
import { TicketsModule } from './tickets/tickets.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ScheduledTasksModule,
    SprintsModule,
    RulesModule,
    SkillsModule,
    RepositoriesModule,
    GitModule,
    AgentRunsModule,
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
