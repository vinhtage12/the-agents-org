import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { adfToText } from '../utils/adf';
export interface JiraSprint {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate: string | null;
  endDate: string | null;
  boardId: number | null;
}
interface RawSprint {
  id: number;
  name: string;
  state: JiraSprint['state'];
  startDate?: string;
  endDate?: string;
  originBoardId?: number;
}
export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  assigneeAccountId: string | null;
  parentKey: string | null;
  sprints: JiraSprint[];
}
interface RawIssue {
  key: string;
  fields: {
    summary: string;
    description: unknown;
    issuetype: { name: string };
    status: { name: string };
    assignee: { accountId: string } | null;
    parent?: { key: string };
    [customField: string]: unknown;
  };
}
interface SearchResponse {
  issues: RawIssue[];
  nextPageToken?: string;
}
const FIELDS = [
  'summary',
  'description',
  'issuetype',
  'status',
  'assignee',
  'parent'
];
export class JiraHttpError extends BadGatewayException {
  constructor(readonly jiraStatus: number) {
    super(`Jira returned HTTP ${jiraStatus}`);
  }
}
const toSprint = (raw: RawSprint): JiraSprint => ({
  id: raw.id,
  name: raw.name,
  state: raw.state,
  startDate: raw.startDate ?? null,
  endDate: raw.endDate ?? null,
  boardId: raw.originBoardId ?? null
});
const toIssue = (
  { key, fields }: RawIssue,
  sprintField: string | null
): JiraIssue => ({
  key,
  summary: fields.summary,
  description: adfToText(fields.description),
  issueType: fields.issuetype.name,
  status: fields.status.name,
  assigneeAccountId: fields.assignee?.accountId ?? null,
  parentKey: fields.parent?.key ?? null,
  sprints:
    (
      (sprintField ? fields[sprintField] : null) as
        | RawSprint[]
        | null
        | undefined
    )?.map(toSprint) ?? []
});
@Injectable()
export class JiraClient {
  constructor(private readonly config: ConfigService) {}
  private get baseUrl(): string {
    return (this.config.get<string>('JIRA_BASE_URL') || '').replace(/\/+$/, '');
  }
  // Scoped API tokens only work through https://api.atlassian.com/ex/jira/<cloudId>.
  private get apiUrl(): string {
    return (this.config.get<string>('JIRA_API_URL') || this.baseUrl).replace(
      /\/+$/,
      ''
    );
  }
  isConfigured(): boolean {
    return Boolean(
      this.baseUrl &&
        this.config.get('JIRA_EMAIL') &&
        this.config.get('JIRA_API_TOKEN')
    );
  }
  private sprintField?: Promise<string | null>;
  // Cached for the process lifetime, null included; a failed lookup means "no
  // sprints" for this call (sync keeps working) and is retried next time.
  sprintFieldId(): Promise<string | null> {
    this.sprintField ??= this.request<
      { id: string; schema?: { custom?: string } }[]
    >('field')
      .then(
        fields =>
          fields.find(
            f => f.schema?.custom === 'com.pyxis.greenhopper.jira:gh-sprint'
          )?.id ?? null
      )
      .catch(() => {
        this.sprintField = undefined;
        return null;
      });
    return this.sprintField;
  }
  private async request<T>(
    path: string,
    body?: unknown,
    api: 'api/3' | 'agile/1.0' = 'api/3'
  ): Promise<T> {
    try {
      const response = await fetch(`${this.apiUrl}/rest/${api}/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.get('JIRA_EMAIL')}:${this.config.get('JIRA_API_TOKEN')}`).toString('base64')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      if (!response.ok) throw new JiraHttpError(response.status);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Jira request failed');
    }
  }
  myself(): Promise<{ accountId: string }> {
    return this.request('myself');
  }
  async search(jql: string): Promise<JiraIssue[]> {
    const issues: JiraIssue[] = [];
    const sprintField = await this.sprintFieldId();
    const fields = sprintField ? [...FIELDS, sprintField] : FIELDS;
    let nextPageToken: string | undefined;
    do {
      const page = await this.request<SearchResponse>('search/jql', {
        jql,
        fields,
        maxResults: 100,
        nextPageToken
      });
      issues.push(...page.issues.map(i => toIssue(i, sprintField)));
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    return issues;
  }
  async getIssue(key: string): Promise<JiraIssue | null> {
    try {
      const sprintField = await this.sprintFieldId();
      const fields = sprintField ? [...FIELDS, sprintField] : FIELDS;
      return toIssue(
        await this.request<RawIssue>(
          `issue/${encodeURIComponent(key)}?fields=${fields.join(',')}`
        ),
        sprintField
      );
    } catch (error) {
      if (error instanceof JiraHttpError && error.jiraStatus === 404)
        return null;
      throw error;
    }
  }
  async getSprint(id: number): Promise<JiraSprint | null> {
    try {
      return toSprint(
        await this.request<RawSprint>(`sprint/${id}`, undefined, 'agile/1.0')
      );
    } catch (error) {
      if (error instanceof JiraHttpError && error.jiraStatus === 404)
        return null;
      throw error;
    }
  }
  browseUrl(key: string): string {
    return `${this.baseUrl}/browse/${key}`;
  }
}
