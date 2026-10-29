import { BASE_API_URL, BASE_API_VERSION } from '#constants/env';

import type { IAgent } from 'dto/types';

export interface AgentStreamEvent {
  type: 'agent' | 'status' | 'output' | 'closed' | 'error';
  agent?: IAgent;
  event?: Record<string, unknown>;
  data?: string;
  encoding?: 'base64';
  message?: string;
}

const apiBase = `${BASE_API_URL.replace(/\/$/, '')}/${BASE_API_VERSION.replace(/^\/+|\/+$/g, '')}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : `Daemon request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export const listAgents = () => request<IAgent[]>('agents');

export const getAgent = (id: string) =>
  request<IAgent>(`agents/${encodeURIComponent(id)}`);

export const sendAgentPrompt = (id: string, prompt: string) =>
  request<unknown>(`agents/${encodeURIComponent(id)}/prompts`, {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });

export const createAgent = (input: {
  agent: 'claude' | 'codex' | 'copilot' | 'antigravity';
  parentPaneId?: string;
  direction?: 'right' | 'down';
}) =>
  request<IAgent & { name: string; ready: boolean }>('agents', {
    method: 'POST',
    body: JSON.stringify(input)
  });

export function openAgentEvents(
  id: string,
  onEvent: (event: AgentStreamEvent) => void,
  onError?: (error: Event) => void
): WebSocket {
  const url = new URL(
    `${apiBase}/agents/${encodeURIComponent(id)}/events`,
    BASE_API_URL
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(url);
  socket.addEventListener('message', message => {
    try {
      onEvent(JSON.parse(String(message.data)) as AgentStreamEvent);
    } catch {
      onEvent({ type: 'error', message: 'Daemon sent an invalid agent event' });
    }
  });
  if (onError) socket.addEventListener('error', onError);
  return socket;
}
