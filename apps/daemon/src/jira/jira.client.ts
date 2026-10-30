import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { adfToText } from './adf';
export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  assigneeAccountId: string | null;
}
interface SearchResponse {
  issues: {
    key: string;
    fields: {
      summary: string;
      description: unknown;
      issuetype: { name: string };
      status: { name: string };
      assignee: { accountId: string } | null;
    };
  }[];
  nextPageToken?: string;
}
@Injectable()
export class JiraClient {
  constructor(private readonly config: ConfigService) {}
  private get baseUrl(): string {
    return (this.config.get<string>('JIRA_BASE_URL') || '').replace(/\/+$/, '');
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
      const response = await fetch(`${this.baseUrl}/rest/api/3/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.get('JIRA_EMAIL')}:${this.config.get('JIRA_API_TOKEN')}`).toString('base64')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      if (!response.ok)
        throw new BadGatewayException(`Jira returned HTTP ${response.status}`);
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
        fields: ['summary', 'description', 'issuetype', 'status', 'assignee'],
        maxResults: 100,
        nextPageToken
      });
      for (const { key, fields } of page.issues)
        issues.push({
          key,
          summary: fields.summary,
          description: adfToText(fields.description),
          issueType: fields.issuetype.name,
          status: fields.status.name,
          assigneeAccountId: fields.assignee?.accountId ?? null
        });
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    return issues;
  }
  browseUrl(key: string): string {
    return `${this.baseUrl}/browse/${key}`;
  }
}
