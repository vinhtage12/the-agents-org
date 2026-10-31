import { buildDevPrompt } from './dev-prompt';

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
it('asks dev to fix every failure in one pass', () => {
  const text = buildDevPrompt({
    ...base,
    spec: '# S',
    failures: [{ position: 2, title: 'Login', detail: 'button missing' }]
  });
  expect(text).toContain('#2 Login: button missing');
  expect(text).toContain('Do not commit, push or switch branches.');
  expect(text).toContain(`${base.run.dir}/output.md`);
});

it('implements the approved spec and handles owner feedback', () => {
  expect(buildDevPrompt({ ...base, spec: '# Approved' })).toContain(
    'implement the approved spec'
  );
  const text = buildDevPrompt({
    ...base,
    spec: '# Approved',
    feedback: 'Use SSO'
  });
  expect(text).toContain("address the owner's feedback");
  expect(text).toContain('Use SSO');
  expect(text).toContain('Approved spec:\n# Approved');
  expect(text).not.toContain('When the spec is final');
  expect(text).toContain('When you are finished:');
});
