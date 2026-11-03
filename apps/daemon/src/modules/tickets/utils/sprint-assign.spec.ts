import { ConflictException } from '@nestjs/common';

import { assertSprintAssignable } from './sprint-assign';

const sprint = (over = {}) => ({
  source: 'LOCAL' as const,
  state: 'FUTURE' as const,
  visibleInProject: true,
  ...over
});
const jiraTicket = { source: 'JIRA' as const, sprintSource: null };
const localTicket = { source: 'LOCAL' as const, sprintSource: null };

describe('assertSprintAssignable', () => {
  it('allows a visible open LOCAL sprint for a JIRA ticket outside Jira sprints', () => {
    expect(() =>
      assertSprintAssignable(jiraTicket, sprint(), 'JIRA')
    ).not.toThrow();
  });

  it('rejects a JIRA ticket that sits in a JIRA sprint', () => {
    expect(() =>
      assertSprintAssignable(
        { source: 'JIRA', sprintSource: 'JIRA' },
        sprint(),
        'HYBRID'
      )
    ).toThrow(new ConflictException('Sprint follows Jira'));
  });

  it('rejects a CLOSED sprint', () => {
    expect(() =>
      assertSprintAssignable(localTicket, sprint({ state: 'CLOSED' }), 'LOCAL')
    ).toThrow(ConflictException);
  });

  it('rejects a sprint that is not visible in the project', () => {
    expect(() =>
      assertSprintAssignable(
        localTicket,
        sprint({ visibleInProject: false }),
        'LOCAL'
      )
    ).toThrow(ConflictException);
  });

  it('allows a JIRA sprint only for a LOCAL ticket in a HYBRID project', () => {
    const jira = sprint({ source: 'JIRA', state: 'ACTIVE' });
    expect(() =>
      assertSprintAssignable(localTicket, jira, 'HYBRID')
    ).not.toThrow();
    expect(() => assertSprintAssignable(localTicket, jira, 'LOCAL')).toThrow(
      ConflictException
    );
    expect(() => assertSprintAssignable(jiraTicket, jira, 'HYBRID')).toThrow(
      ConflictException
    );
  });

  it('null (Backlog) is blocked only for a JIRA ticket in a JIRA sprint', () => {
    expect(() =>
      assertSprintAssignable(
        { source: 'JIRA', sprintSource: 'JIRA' },
        null,
        'HYBRID'
      )
    ).toThrow(new ConflictException('Sprint follows Jira'));
    expect(() =>
      assertSprintAssignable(jiraTicket, null, 'JIRA')
    ).not.toThrow();
    expect(() =>
      assertSprintAssignable(
        { source: 'LOCAL', sprintSource: 'JIRA' },
        null,
        'HYBRID'
      )
    ).not.toThrow();
  });
});
