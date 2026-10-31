import { buildSpecPrompt, type SpecPromptInput } from './spec-prompt';

const input: SpecPromptInput = {
  profile: {
    slug: 'analyst',
    name: 'Analyst',
    provider: 'claude',
    skills: ['brainstorming'],
    instructions: 'Think hard.'
  },
  ticket: {
    jiraKey: 'FMS-1',
    summary: 'Login',
    description: 'Users log in',
    jiraUrl: 'https://j/browse/FMS-1',
    extraInstructions: 'Use SSO.',
    extraSkills: ['brainstorming', 'jira']
  },
  repoPath: '/repos/ff-web',
  run: {
    id: 7,
    token: 'tok',
    dir: '/runs/7',
    callbackUrl: 'http://127.0.0.1:3005/api/v1'
  }
};

describe('buildSpecPrompt', () => {
  it('builds the first spec prompt with the callback contract', () => {
    const text = buildSpecPrompt(input);
    expect(text).toContain('Think hard.');
    expect(text).toContain('Use SSO.');
    expect(text).toContain('Skills: brainstorming, jira');
    expect(text).toContain('FMS-1');
    expect(text).toContain('Users log in');
    expect(text).toContain('/repos/ff-web');
    expect(text).toContain('/runs/7/output.md');
    expect(text).toContain(
      "curl -fsS -X POST -H 'x-run-token: tok' http://127.0.0.1:3005/api/v1/agent-runs/7/complete"
    );
    expect(text).not.toContain('Feedback');
  });

  it('omits the skills line when there are none', () => {
    const text = buildSpecPrompt({
      ...input,
      profile: { ...input.profile, skills: [] },
      ticket: { ...input.ticket, extraSkills: [] }
    });
    expect(text).not.toContain('Skills:');
  });

  it('includes the hand-edited spec and feedback', () => {
    const text = buildSpecPrompt({
      ...input,
      previous: {
        version: 2,
        content: '# Spec\nEdited by owner',
        feedback: 'Split step 3'
      }
    });
    expect(text).toContain('Edited by owner');
    expect(text).toContain('Split step 3');
    expect(text).toContain('v2');
  });
});
