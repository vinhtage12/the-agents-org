import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { adfToText } from '../utils/adf';
export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  assigneeAccountId: string | null;
}
interface RawIssue {
  key: string;
  fields: {
    summary: string;
    description: unknown;
    issuetype: { name: string };
    status: { name: string };
    assignee: { accountId: string } | null;
  };
}
interface SearchResponse {
  issues: RawIssue[];
  nextPageToken?: string;
}
const FIELDS = ['summary', 'description', 'issuetype', 'status', 'assignee'];
export class JiraHttpError extends BadGatewayException {
  constructor(readonly jiraStatus: number) {
    super(`Jira returned HTTP ${jiraStatus}`);
  }
}
const toIssue = ({ key, fields }: RawIssue): JiraIssue => ({
  key,
  summary: fields.summary,
  description: adfToText(fields.description),
  issueType: fields.issuetype.name,
  status: fields.status.name,
  assigneeAccountId: fields.assignee?.accountId ?? null
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
  private async request<T>(path: string, body?: unknown): Promise<T> {
    try {
      const response = await fetch(`${this.apiUrl}/rest/api/3/${path}`, {
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
    let nextPageToken: string | undefined;
    do {
      const page = await this.request<SearchResponse>('search/jql', {
        jql,
        fields: FIELDS,
        maxResults: 100,
        nextPageToken
      });
      issues.push(...page.issues.map(toIssue));
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    return issues;
  }
  async getIssue(key: string): Promise<JiraIssue | null> {
    try {
      return toIssue(
        await this.request<RawIssue>(
          `issue/${encodeURIComponent(key)}?fields=${FIELDS.join(',')}`
        )
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
