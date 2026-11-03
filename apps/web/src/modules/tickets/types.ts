import type { IAgentRef, IOption } from '#modules/warehouse';
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
  branch: string | null;
  repoId: number | null;
  agent: { id: number; name: string } | null;
}
export interface IRepoConflict {
  id: number;
  jiraKey: string;
  projectId: number | null;
}
export interface INewBranch {
  base: string;
  name: string;
  push: boolean;
}
export interface IMoveTicket {
  ticketId: number;
  to: TicketStatus;
  branch?: INewBranch;
}
export interface IGitBranches {
  data: { label: string }[];
  base: string | null;
}
export type AgentStep = 'SPEC' | 'DEV' | 'TEST';
export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
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
export interface ITicketAgents<TValue> {
  specAgent: TValue;
  devAgent: TValue;
  testAgent: TValue;
}
export interface ITicketDetail
  extends ITicketBase,
    ITicketAgents<IAgentRef | null> {
  description: string;
  status: TicketStatus;
  projectId: number | null;
  repoId: number | null;
  extraInstructions: string;
  branch: string | null;
  skills: { id: number; name: string; provider: string; command: string }[];
  rules: { id: number; name: string }[];
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
export interface IUpdateTicket {
  projectId?: number;
  repoId?: number | null;
  specAgentId?: number | null;
  devAgentId?: number | null;
  testAgentId?: number | null;
  skillIds?: number[];
  ruleIds?: number[];
  extraInstructions?: string;
}
export interface ITicketSettingsValues extends ITicketAgents<IOption | null> {
  projectId: string;
  repoId: string;
  skills: IOption[];
  rules: IOption[];
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
export interface IBranchValues {
  base: { label: string } | null;
  type: string;
  name: string;
}
