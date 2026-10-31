import { AgentRunsController } from './agent-runs.controller';

import type { TicketFlowService } from '../services/ticket-flow.service';

describe('AgentRunsController', () => {
  it('passes the run id and token header to the service', async () => {
    const ticketFlow = { complete: jest.fn().mockResolvedValue(undefined) };
    const controller = new AgentRunsController(
      ticketFlow as unknown as TicketFlowService
    );
    await expect(controller.complete(1, 'tok')).resolves.toBeUndefined();
    expect(ticketFlow.complete).toHaveBeenCalledWith(1, 'tok');
  });
});
