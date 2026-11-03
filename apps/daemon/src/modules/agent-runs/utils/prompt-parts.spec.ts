import { type PromptBase, outputContract, promptHeader } from './prompt-parts';

const base: PromptBase = {
  profile: {
    id: 1,
    name: 'Analyst',
    provider: 'claude',
    model: null,
    effort: null,
    path: '/x/members/analyst',
    allowedTools: [],
    skills: [
      { command: '/brainstorming', description: 'Plan', provider: 'claude' }
    ],
    rules: [{ path: '/rules/a.md' }]
  },
  ticket: {
    jiraKey: 'FMS-1',
    summary: 'Login',
    description: 'Users log in',
    jiraUrl: 'https://j/browse/FMS-1',
    specPath: null,
    extraInstructions: 'Use SSO.',
    skills: [
      { command: '/brainstorming', description: 'Plan', provider: 'claude' },
      { command: '/jira', description: 'Jira', provider: 'claude' },
      { command: '$other', description: 'Codex only', provider: 'codex' }
    ],
    rules: [{ path: '/rules/a.md' }, { path: '/rules/b.md' }]
  },
  repoPath: '/repos/ff-web',
  run: {
    id: 7,
    token: 'tok',
    dir: '/runs/7',
    callbackUrl: 'http://127.0.0.1:3005/api/v1'
  }
};
it('points the prompt at AGENT.md, rule paths and same-provider skills', () => {
  expect(promptHeader(base)).toEqual([
    'Read and follow your role description: /x/members/analyst/AGENT.md',
    'Use SSO.',
    'Rules (read each before starting):\n- /rules/a.md\n- /rules/b.md',
    'Skills you can use:\n- /brainstorming: Plan\n- /jira: Jira',
    'Ticket FMS-1: Login\nhttps://j/browse/FMS-1\n\nUsers log in',
    'Repository: /repos/ff-web'
  ]);
});
it('uses the shared completion contract', () => {
  expect(
    outputContract(base.run, 'output.md', 'the full spec as markdown')
  ).toBe(
    [
      'When you are finished:',
      '1. Write the full spec as markdown to /runs/7/output.md (overwrite it).',
      "2. Run: curl -fsS -X POST -H 'x-run-token: tok' http://127.0.0.1:3005/api/v1/agent-runs/7/complete",
      'Do not run the command before output.md is complete. If it fails, fix the problem and run it again.'
    ].join('\n')
  );
});
it('drops the empty URL line and points at the spec file', () => {
  const header = promptHeader({
    ...base,
    ticket: { ...base.ticket, jiraUrl: '', specPath: '/s/a.md' }
  });
  expect(header).toContain('Ticket FMS-1: Login\n\nUsers log in');
  expect(header).toContain(
    'Spec source file (read it before anything else): /s/a.md'
  );
});
