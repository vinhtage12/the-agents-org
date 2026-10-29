import { type Socket, io } from 'socket.io-client';

import { RequestMethods } from '@truyenmoinhu/query';

import { BASE_API_URL, BASE_API_VERSION } from '#constants/env';
import { apiManagerInstance } from '#constants/query';

import type { IAgent } from 'dto/types';
import type {
  AgentStreamEvent,
  ICreateAgentInput,
  ICreatedAgent
} from './types';

const apiBase = `${BASE_API_URL.replace(/\/$/, '')}/${BASE_API_VERSION.replace(/^\/+|\/+$/g, '')}`;
const request = async <T>(
  url: string,
  method = RequestMethods.GET,
  data?: unknown
): Promise<T> => {
  const result = await apiManagerInstance.sendRequest<T>({
    url,
    method,
    data,
    suppressNotifyOnError: true
  });
  if (!result.success) {
    throw new Error(result.message || `Daemon request failed (${result.code})`);
  }
  return result.payload as T;
};

export const listAgents = () => request<IAgent[]>('agents');
export const getAgent = (id: string) =>
  request<IAgent>(`agents/${encodeURIComponent(id)}`);
export const sendAgentPrompt = (id: string, prompt: string) =>
  request<unknown>(
    `agents/${encodeURIComponent(id)}/prompts`,
    RequestMethods.POST,
    { prompt }
  );
export const createAgent = (input: ICreateAgentInput) =>
  request<ICreatedAgent>('agents', RequestMethods.POST, input);

export const openAgentEvents = (
  id: string,
  onEvent: (event: AgentStreamEvent) => void,
  onError?: (error: Error) => void
): Socket => {
  const namespace = `${apiBase}/agents`;
  const socket = io(namespace, {
    path: `/${BASE_API_VERSION.replace(/^\/+|\/+$/g, '')}/socket.io`,
    transports: ['websocket'],
    auth: { agentId: id }
  });
  socket.on('agent-event', (event: AgentStreamEvent) => onEvent(event));
  if (onError) {
    socket.on('connect_error', onError);
  }
  return socket;
};
