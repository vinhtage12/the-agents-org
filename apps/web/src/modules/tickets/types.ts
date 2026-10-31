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
export interface IBoardTicket extends ITicketBase {
  status: TicketStatus;
}
