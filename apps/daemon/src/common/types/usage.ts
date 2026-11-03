/** Who references a warehouse item; shown in the "in use by" panel. */
export type IUsage = {
  projects: { id: number; name: string; code: string; workspaceId: number }[];
  tickets: {
    id: number;
    jiraKey: string;
    projectId: number | null;
    workspaceId: number | null;
  }[];
  agents: { id: number; name: string }[];
};

type UsageTicketRow = {
  id: number;
  jiraKey: string;
  projectId: number | null;
  project: { workspaceId: number } | null;
};

/** Select fragment + mapper for the ticket part of an IUsage. */
export const USAGE_TICKET_SELECT = {
  id: true,
  jiraKey: true,
  projectId: true,
  project: { select: { workspaceId: true } }
} as const;

export const toUsageTickets = (rows: UsageTicketRow[]): IUsage['tickets'] =>
  rows.map(({ project, ...t }) => ({
    ...t,
    workspaceId: project?.workspaceId ?? null
  }));
