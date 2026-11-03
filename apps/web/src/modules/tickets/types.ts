import type { RequestMethods } from '@truyenmoinhu/query';
import type { IAgentRef, IOption } from '#modules/warehouse';
import type { TSpecSource } from '#modules/workspaces';
import type { ISSUE_TYPES } from './constants';
import type {
  AgentRunStatus,
  AgentStep,
  BoardLabel,
  SprintState,
  TestMode,
  TicketSource,
  TicketSpecMode,
  TicketStatus
} from './enum';

export type {
  AgentRunStatus,
  AgentStep,
  BoardLabel,
  SprintState,
  TestMode,
  TicketSource,
  TicketSpecMode,
  TicketStatus
};
export type IssueType = (typeof ISSUE_TYPES)[number];
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
  sprints: number;
}
export interface IBoardTicket extends ITicketBase {
  status: TicketStatus;
  label: BoardLabel | null;
  specVersion: number | null;
  branch: string | null;
  repoId: number | null;
  agent: { id: number; name: string } | null;
  source: TicketSource;
  sprintId: number | null;
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
  testMode: TestMode | null;
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
  source: TicketSource;
  issueType: IssueType;
  specFile: string | null;
  sprintId: number | null;
  sprintSource: TicketSource | null;
  projectSpecSource: TSpecSource | null;
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
  sprintId?: number | null;
}
export interface ITicketSettingsValues extends ITicketAgents<IOption | null> {
  projectId: string;
  repoId: string;
  skills: IOption[];
  rules: IOption[];
  extraInstructions: string;
  sprint: string;
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
export interface ISprint {
  id: number;
  source: TicketSource;
  name: string;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
}
export interface ISprintRequest {
  url: string;
  method: RequestMethods;
  data?: unknown;
}
export type SprintTarget = number | 'new' | 'backlog';
export interface ISprintValues {
  name: string;
  startDate: string;
  endDate: string;
}
export interface IBoardSplit {
  columns: IBoardTicket[];
  backlog: IBoardTicket[];
}
export interface ISpecFiles {
  data: { label: string }[];
}
export interface ILocalTicketContent {
  summary: string;
  issueType: IssueType;
  specFile?: string | null;
  description?: string;
}
export interface ICreateLocalTicket extends ILocalTicketContent {
  sprintId?: number | null;
}
export interface ICreateLocalTicketRequest {
  projectId: number;
  data: ICreateLocalTicket;
}
export interface ILocalTicketValues {
  summary: string;
  issueType: IssueType;
  mode: TicketSpecMode;
  specFile: string;
  description: string;
  sprint: string;
}
