import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JiraClient, JiraHttpError } from './jira.client';

describe('JiraClient', () => {
  const original = global.fetch;
  const fetchMock = jest.fn();
  let client: JiraClient;
  const noFields = { ok: true, json: async () => [] };
  const sprintField = {
    ok: true,
    json: async () => [
      {
        id: 'customfield_10020',
        schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' }
      }
    ]
  };
  const rawIssue = (extra: Record<string, unknown> = {}) => ({
    key: 'FMS-9',
    fields: {
      summary: 'S',
      description: null,
      issuetype: { name: 'Task' },
      status: { name: 'Open' },
      assignee: null,
      ...extra
    }
  });
  beforeEach(() => {
    client = new JiraClient(
      new ConfigService({
        JIRA_BASE_URL: 'https://jira/',
        JIRA_EMAIL: 'me@example.com',
        JIRA_API_TOKEN: 'token'
      })
    );
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });
  afterAll(() => {
    global.fetch = original;
  });
  it('reads all search pages and converts ADF', async () => {
    fetchMock
      .mockResolvedValueOnce(noFields)
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
                assignee: { accountId: 'me' },
                parent: { key: 'FMS-0' }
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
        assigneeAccountId: 'me',
        parentKey: 'FMS-0',
        sprints: []
      }
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      nextPageToken: 'next',
      jql: 'query',
      maxResults: 100
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://jira/rest/api/3/field');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://jira/rest/api/3/search/jql'
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).fields).toEqual([
      'summary',
      'description',
      'issuetype',
      'status',
      'assignee',
      'parent'
    ]);
    expect(client.browseUrl('FMS-1')).toBe('https://jira/browse/FMS-1');
  });
  it('sends API calls to JIRA_API_URL when set, but browses on the site', async () => {
    const scoped = new JiraClient(
      new ConfigService({
        JIRA_BASE_URL: 'https://site',
        JIRA_API_URL: 'https://api.atlassian.com/ex/jira/cloud/',
        JIRA_EMAIL: 'me@example.com',
        JIRA_API_TOKEN: 'token'
      })
    );
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accountId: 'me' })
    });
    await scoped.myself();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.atlassian.com/ex/jira/cloud/rest/api/3/myself'
    );
    expect(scoped.browseUrl('FMS-1')).toBe('https://site/browse/FMS-1');
  });
  it('reports HTTP errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(client.myself()).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('getIssue returns the issue, or null when Jira answers 404', async () => {
    fetchMock
      .mockResolvedValueOnce(noFields)
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
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://jira/rest/api/3/issue/FMS-2?fields=summary,description,issuetype,status,assignee,parent'
    );
  });
  it('finds the sprint field once and reads sprints from issues', async () => {
    fetchMock
      .mockResolvedValueOnce(sprintField)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [
            rawIssue({
              customfield_10020: [
                {
                  id: 7,
                  name: 'S7',
                  state: 'active',
                  startDate: '2026-11-01T00:00:00.000Z',
                  endDate: null,
                  originBoardId: 3
                },
                { id: 6, name: 'S6', state: 'closed' }
              ]
            })
          ]
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ issues: [] }) });
    const [issue] = await client.search('q');
    expect(issue.sprints).toEqual([
      {
        id: 7,
        name: 'S7',
        state: 'active',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: null,
        boardId: 3
      },
      {
        id: 6,
        name: 'S6',
        state: 'closed',
        startDate: null,
        endDate: null,
        boardId: null
      }
    ]);
    await client.search('q');
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/field'))
    ).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).fields).toContain(
      'customfield_10020'
    );
  });
  it('treats a missing sprint value as no sprints', async () => {
    fetchMock
      .mockResolvedValueOnce(sprintField)
      .mockResolvedValueOnce({ ok: true, json: async () => rawIssue() });
    expect((await client.getIssue('FMS-9'))?.sprints).toEqual([]);
    expect(fetchMock.mock.calls[1][0]).toContain(',customfield_10020');
  });
  it('syncs without sprints when the field lookup is refused', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => rawIssue() });
    expect((await client.getIssue('FMS-9'))?.sprints).toEqual([]);
  });
  it('getSprint returns null on 404 and throws JiraHttpError otherwise', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 5, name: 'S5', state: 'future' })
      })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(client.getSprint(5)).resolves.toMatchObject({
      id: 5,
      boardId: null
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://jira/rest/agile/1.0/sprint/5'
    );
    await expect(client.getSprint(6)).resolves.toBeNull();
    await expect(client.getSprint(7)).rejects.toMatchObject({
      jiraStatus: 403
    });
    expect(JiraHttpError).toBeDefined();
  });
});
