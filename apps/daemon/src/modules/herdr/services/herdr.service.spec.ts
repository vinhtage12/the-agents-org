import {
  BadGatewayException,
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
    jest.resetAllMocks();
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

  it('reads recent agent output as text', async () => {
    herdr.request
      .mockResolvedValueOnce({ agents: [{ pane_id: 'w1:p2', agent: 'codex' }] })
      .mockResolvedValueOnce({ read: { text: 'hello' } });

    await expect(service.readAgent('w1:p2', 200)).resolves.toBe('hello');
    expect(herdr.request).toHaveBeenNthCalledWith(1, 'agent.list');
    expect(herdr.request).toHaveBeenLastCalledWith('agent.read', {
      target: 'w1:p2',
      source: 'recent',
      lines: 200,
      strip_ansi: true
    });
  });

  it('rejects reading an unknown agent', async () => {
    herdr.request.mockResolvedValueOnce({ agents: [] });
    await expect(service.readAgent('w1:p2', 200)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(herdr.request).toHaveBeenCalledTimes(1);
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
      target_pane_id: 'w1:p2'
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

  it('passes cwd to pane.split and args to agent.start', async () => {
    herdr.request
      .mockResolvedValueOnce({ pane: { pane_id: 'w1:p9' } })
      .mockResolvedValueOnce({
        agent: { pane_id: 'w1:p9', agent: 'claude', agent_status: 'idle' }
      });
    await service.createAgent({
      agent: 'claude',
      cwd: '/repos/ff-web',
      args: ['--model', 'opus'],
      parentPaneId: 'w1:p1'
    });
    expect(herdr.request).toHaveBeenNthCalledWith(1, 'pane.split', {
      direction: 'right',
      cwd: '/repos/ff-web',
      target_pane_id: 'w1:p1'
    });
    expect(herdr.request).toHaveBeenNthCalledWith(
      2,
      'agent.start',
      expect.objectContaining({ pane_id: 'w1:p9', args: ['--model', 'opus'] }),
      35000
    );
  });

  it('closeAgent ignores panes that are already gone', async () => {
    herdr.request.mockRejectedValueOnce(new HerdrApiError('gone', 'not_found'));
    await expect(service.closeAgent('w1:p9')).resolves.toBeUndefined();
    expect(herdr.request).toHaveBeenCalledWith('pane.close', {
      pane_id: 'w1:p9'
    });
    herdr.request.mockRejectedValueOnce(
      new HerdrApiError('boom', 'herdr_error')
    );
    await expect(service.closeAgent('w1:p9')).rejects.toBeInstanceOf(
      BadGatewayException
    );
  });

  it('subscribeAgent reports changes but not the start ack', () => {
    const stop = jest.fn();
    herdr.subscribe.mockReturnValue(stop);
    const onChange = jest.fn();
    expect(service.subscribeAgent('w1:p9', onChange)).toBe(stop);
    const [panes, onEvent, onError] = herdr.subscribe.mock.calls[0];
    expect(panes).toEqual(['w1:p9']);
    onEvent({ type: 'subscription_started' });
    onEvent({ event: 'pane.agent_status_changed' });
    onError(new Error('closed'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
