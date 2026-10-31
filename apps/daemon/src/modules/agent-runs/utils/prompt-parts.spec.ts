import { type PromptBase, outputContract, promptHeader } from './prompt-parts';

const base: PromptBase = {
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
it('preserves shared sections and deduplicates skills', () => {
  expect(promptHeader(base)).toEqual([
    'Think hard.',
    'Use SSO.',
    'Skills: brainstorming, jira',
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
