import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';

import { HerdrApiError, HerdrClient } from '../clients/herdr.client';
import { HerdrService } from './herdr.service';

describe('HerdrService', () => {
  const herdr = {
    request: jest.fn(),
    subscribe: jest.fn()
  };
  let service: HerdrService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HerdrService(
      herdr as unknown as HerdrClient,
      { get: () => 'herdr' } as never
    );
  });

  it('maps live Herdr agents to the public API model', async () => {
    herdr.request.mockResolvedValueOnce({
      agents: [
        {
          pane_id: 'w1:p2',
          agent: 'claude',
          agent_status: 'working',
          workspace_id: 'w1',
          tab_id: 'w1:t1',
          cwd: '/workspace'
        }
      ]
    });

    await expect(service.listAgents()).resolves.toEqual([
      {
        id: 'w1:p2',
        paneId: 'w1:p2',
        agent: 'claude',
        status: 'working',
        workspaceId: 'w1',
        tabId: 'w1:t1',
        cwd: '/workspace'
      }
    ]);
    expect(herdr.request).toHaveBeenCalledWith('agent.list');
  });

  it('only sends prompts to a currently listed agent', async () => {
    herdr.request
      .mockResolvedValueOnce({ agents: [{ pane_id: 'w1:p2', agent: 'codex' }] })
      .mockResolvedValueOnce({ type: 'agent_prompt' });

    await expect(
      service.sendPrompt('w1:p2', 'Inspect this change')
    ).resolves.toEqual({
      type: 'agent_prompt'
    });
    expect(herdr.request).toHaveBeenLastCalledWith('agent.prompt', {
      target: 'w1:p2',
      text: 'Inspect this change'
    });
  });

  it('rejects blocked agents without retrying the prompt', async () => {
    herdr.request
      .mockResolvedValueOnce({ agents: [{ pane_id: 'w1:p2', agent: 'codex' }] })
      .mockRejectedValueOnce(
        new HerdrApiError('agent is blocked', 'agent_blocked')
      );

    await expect(
      service.sendPrompt('w1:p2', 'Continue')
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when the requested pane has no live agent', async () => {
    herdr.request.mockResolvedValueOnce({ agents: [] });
    await expect(service.getAgent('w1:p2')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('creates a pane and starts the requested agent kind', async () => {
    herdr.request
      .mockResolvedValueOnce({ pane: { pane_id: 'w1:p3' } })
      .mockResolvedValueOnce({
        agent: {
          pane_id: 'w1:p3',
          agent: 'agy',
          agent_status: 'idle'
        }
      });

    const result = await service.createAgent({
      agent: 'antigravity',
      parentPaneId: 'w1:p2',
      direction: 'down'
    });

    expect(result).toMatchObject({
      id: 'w1:p3',
      paneId: 'w1:p3',
      agent: 'agy',
      status: 'idle',
      ready: true
    });
    expect(result.name).toMatch(/^web-[a-f0-9]{8}$/);
    expect(herdr.request).toHaveBeenNthCalledWith(1, 'pane.split', {
      direction: 'down',
      pane_id: 'w1:p2'
    });
    expect(herdr.request).toHaveBeenNthCalledWith(
      2,
      'agent.start',
      expect.objectContaining({
        kind: 'agy',
        pane_id: 'w1:p3',
        args: [],
        timeout_ms: 30000
      }),
      35000
    );
  });

  it('rejects unsupported agent kinds before creating a pane', async () => {
    await expect(
      service.createAgent({ agent: 'unknown-agent' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(herdr.request).not.toHaveBeenCalled();
  });
});
