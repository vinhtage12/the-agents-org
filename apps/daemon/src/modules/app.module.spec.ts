import { Test } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { AgentRunsController } from './agent-runs/controllers/agent-runs.controller';
import { BoardGateway } from './agent-runs/gateways/board.gateway';
import { AgentRunsService } from './agent-runs/services/agent-runs.service';
import { AgentProfilesController } from './agent-profiles/controllers/agent-profiles.controller';
import { AgentUsageService } from './agent-usage/services/agent-usage.service';
import { AppModule } from './app.module';
import { HerdrController } from './herdr/controllers/herdr.controller';
import { HerdrGateway } from './herdr/gateways/herdr.gateway';
import { ProjectSettingsController } from './projects/controllers/project-settings.controller';
import { SystemController } from './system/controllers/system.controller';
import { TicketsController } from './tickets/controllers/tickets.controller';
import { WorkspacesController } from './workspaces/controllers/workspaces.controller';

describe('AppModule domain wiring', () => {
  it('resolves controllers and cross-module dependencies', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    try {
      for (const provider of [
        AgentRunsController,
        AgentRunsService,
        BoardGateway,
        AgentProfilesController,
        AgentUsageService,
        HerdrController,
        HerdrGateway,
        ProjectSettingsController,
        SystemController,
        TicketsController,
        WorkspacesController
      ]) {
        expect(module.get(provider)).toBeDefined();
      }
    } finally {
      await module.close();
    }
  });
});
