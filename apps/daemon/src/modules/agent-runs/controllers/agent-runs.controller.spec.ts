import { Test, TestingModule } from '@nestjs/testing';

import { AgentRunsService } from '../services/agent-runs.service';
import { AgentRunsController } from './agent-runs.controller';

describe('AgentRunsController', () => {
  it('resolves its service', async () => {
    const service = {};
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentRunsController],
      providers: [{ provide: AgentRunsService, useValue: service }]
    }).compile();
    try {
      expect(module.get(AgentRunsController).service).toBe(service);
    } finally {
      await module.close();
    }
  });
});
