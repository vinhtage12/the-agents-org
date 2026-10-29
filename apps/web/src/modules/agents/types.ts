import type { IAgent } from 'dto/types';
export interface IAgentStreamEvent {
  type: 'agent' | 'status' | 'output' | 'closed' | 'error';
  agent?: IAgent;
  event?: Record<string, unknown>;
  data?: string;
  encoding?: 'base64';
  message?: string;
}
export type AgentStreamEvent = IAgentStreamEvent;
export interface ICreateAgentInput {
  agent: 'claude' | 'codex' | 'copilot' | 'antigravity';
  parentPaneId?: string;
  direction?: 'right' | 'down';
}
export interface ICreatedAgent extends IAgent {
  name: string;
  ready: boolean;
}
