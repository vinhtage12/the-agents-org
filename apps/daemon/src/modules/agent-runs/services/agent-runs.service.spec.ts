import { Test, TestingModule } from '@nestjs/testing';

import { AgentRunsService } from './agent-runs.service';

describe('AgentRunsService', () => {
  it('can be injected', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRunsService]
    }).compile();
    try {
      expect(module.get(AgentRunsService)).toBeInstanceOf(AgentRunsService);
    } finally {
      await module.close();
    }
  });
});
