import type { IAgent } from 'dto/types';
import type { AgentKind, AgentStreamEventType, SplitDirection } from './enum';

export type { AgentKind, AgentStreamEventType, SplitDirection };
export interface IAgentStreamEvent {
  type: AgentStreamEventType;
  agent?: IAgent;
  event?: Record<string, unknown>;
  data?: string;
  encoding?: 'base64';
  message?: string;
}
export type AgentStreamEvent = IAgentStreamEvent;
export interface ICreateAgentInput {
  agent: AgentKind;
  parentPaneId?: string;
  direction?: SplitDirection;
}
export interface ICreatedAgent extends IAgent {
  name: string;
  ready: boolean;
}
