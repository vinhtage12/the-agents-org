import { AgentRunsController } from './agent-runs.controller';

import type { AgentRunsService } from '../services/agent-runs.service';

describe('AgentRunsController', () => {
  it('passes the run id and token header to the service', async () => {
    const agentRuns = { complete: jest.fn().mockResolvedValue(undefined) };
    const controller = new AgentRunsController(
      agentRuns as unknown as AgentRunsService
    );
    await expect(controller.complete(1, 'tok')).resolves.toBeUndefined();
    expect(agentRuns.complete).toHaveBeenCalledWith(1, 'tok');
  });
});
