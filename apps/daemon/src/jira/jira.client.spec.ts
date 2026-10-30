import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JiraClient } from './jira.client';

describe('JiraClient', () => {
  const original = global.fetch;
  const fetchMock = jest.fn();
  const client = new JiraClient(
    new ConfigService({
      JIRA_BASE_URL: 'https://jira/',
      JIRA_EMAIL: 'me@example.com',
      JIRA_API_TOKEN: 'token'
    })
  );
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });
  afterAll(() => {
    global.fetch = original;
  });
  it('reads all search pages and converts ADF', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [
            {
              key: 'FMS-1',
              fields: {
                summary: 'A',
                description: {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Body' }]
                },
                issuetype: { name: 'Task' },
                status: { name: 'Open' },
                assignee: { accountId: 'me' }
              }
            }
          ],
          nextPageToken: 'next'
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ issues: [] }) });
    expect(await client.search('query')).toEqual([
      {
        key: 'FMS-1',
        summary: 'A',
        description: 'Body',
        issueType: 'Task',
        status: 'Open',
        assigneeAccountId: 'me'
      }
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      nextPageToken: 'next',
      jql: 'query',
      maxResults: 100
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://jira/rest/api/3/search/jql'
    );
    expect(client.browseUrl('FMS-1')).toBe('https://jira/browse/FMS-1');
  });
  it('reports HTTP errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(client.myself()).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('getIssue returns the issue, or null when Jira answers 404', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'FMS-2',
          fields: {
            summary: 'S',
            description: null,
            issuetype: { name: 'Bug' },
            status: { name: 'Done' },
            assignee: { accountId: 'me' }
          }
        })
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(client.getIssue('FMS-2')).resolves.toMatchObject({
      key: 'FMS-2',
      status: 'Done',
      assigneeAccountId: 'me'
    });
    await expect(client.getIssue('FMS-3')).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://jira/rest/api/3/issue/FMS-2?fields=summary,description,issuetype,status,assignee'
    );
  });
});
