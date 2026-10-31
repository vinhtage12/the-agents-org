import { buildRunCasesPrompt, buildWriteCasesPrompt } from './test-prompts';

import type { PromptBase } from './prompt-parts';

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
it('tells the testing agent not to touch code and to stop the dev server', () => {
  const text = buildRunCasesPrompt({
    ...base,
    cases: [{ position: 1, title: 'T', steps: 'S', expected: 'E' }]
  });
  expect(text).toMatch(/do not (modify|change) (any )?code/i);
  expect(text).toMatch(/stop the dev server/i);
  expect(text).toContain(
    'Test cases:\n' +
      JSON.stringify([{ position: 1, title: 'T', steps: 'S', expected: 'E' }])
  );
  expect(text).toContain(
    'Report exactly one result for every test case position.'
  );
  expect(text).toContain(`${base.run.dir}/output.json`);
});

it('requests spec coverage and browser cases without repository writes', () => {
  const text = buildWriteCasesPrompt({ ...base, spec: '# Approved' });
  expect(text).toContain('Approved spec:\n# Approved');
  expect(text).toContain('browser');
  expect(text).toContain(
    'Do not modify or create any files in the repository.'
  );
  expect(text).toContain(
    '{"cases":[{"title":"...","steps":"...","expected":"..."}]}'
  );
  expect(text).toContain(`${base.run.dir}/output.json`);
});
