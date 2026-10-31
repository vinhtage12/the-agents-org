import type { TICKET_STATUSES } from './constants';

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPlacement = Record<number, number | null>;
export interface ITicketBase {
  id: number;
  jiraKey: string;
  summary: string;
  jiraUrl: string;
}
export interface IStoreTicket extends ITicketBase {
  issueType: string;
  suggestedProjectId: number | null;
}
export interface IStoreProject {
  id: number;
  name: string;
  code: string;
  workspaceId: number;
}
export interface ITicketStore {
  tickets: IStoreTicket[];
  projects: IStoreProject[];
}
export interface ILinkTicket {
  ticketId: number;
  projectId: number;
}
export interface ISyncResult {
  created: number;
  updated: number;
  canceled: number;
  reopened: number;
}
export type BoardLabel = 'running' | 'approved' | 'needs_you';
export interface IBoardTicket extends ITicketBase {
  status: TicketStatus;
  label: BoardLabel | null;
  specVersion: number | null;
}
export interface IRepoConflict {
  id: number;
  jiraKey: string;
  projectId: number | null;
}
export interface IMoveTicket {
  ticketId: number;
  to: TicketStatus;
}
export type AgentStep = 'SPEC' | 'DEV' | 'TEST';
export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
export interface IAgentOption {
  slug: string;
  name: string;
  provider: string;
  model?: string;
}
export interface ISpecVersion {
  version: number;
  content: string;
  editedAt: string | null;
  feedback: string | null;
}
export interface IAgentRun {
  id: number;
  step: AgentStep;
  agentSlug: string;
  status: AgentRunStatus;
  paneId: string | null;
  error: string | null;
  testMode: 'WRITE_CASES' | 'RUN_CASES' | null;
  startedAt: string;
  finishedAt: string | null;
}
export interface ITestCase {
  id: number;
  position: number;
  title: string;
  steps: string;
  expected: string;
}
export interface ITestResult {
  position: number;
  passed: boolean;
  detail: string;
}
export interface ITestResults {
  agentRunId: number;
  finishedAt: string;
  results: ITestResult[];
}
export interface ITicketAgents<TValue = string | null> {
  specAgent: TValue;
  devAgent: TValue;
  testAgent: TValue;
}
export interface ITicketDetail extends ITicketBase, ITicketAgents {
  description: string;
  status: TicketStatus;
  projectId: number | null;
  repoId: number | null;
  extraInstructions: string;
  extraSkills: string[];
  specApprovedAt: string | null;
  label: BoardLabel | null;
  spec: ISpecVersion | null;
  repos: { id: number; name: string; path: string }[];
  projects: { id: number; name: string; code: string }[];
  runs: IAgentRun[];
  fixRound: number;
  testCases: ITestCase[];
  testResults: ITestResults | null;
}
export type IUpdateTicket = Partial<
  Pick<
    ITicketDetail,
    | 'projectId'
    | 'repoId'
    | 'specAgent'
    | 'devAgent'
    | 'testAgent'
    | 'extraInstructions'
    | 'extraSkills'
  >
>;
export interface ITicketSettingsValues extends ITicketAgents<string> {
  projectId: string;
  repoId: string;
  extraSkills: string;
  extraInstructions: string;
}
export interface ITicketRequest<TData = unknown> {
  ticketId: number;
  data?: TData;
}
export interface IReplyAgent {
  paneId: string;
  prompt: string;
}
