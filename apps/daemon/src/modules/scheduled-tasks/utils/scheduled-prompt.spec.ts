import { buildScheduledPrompt } from './scheduled-prompt';

import type { RunAgent } from '#modules/agent-runs/utils/spec-prompt';

const profile: RunAgent = {
  id: 1,
  name: 'Analyst',
  provider: 'claude',
  model: null,
  effort: null,
  path: '/members/analyst',
  allowedTools: [],
  rules: [{ path: '/rules/a.md' }],
  skills: [
    { command: '/brainstorming', description: 'Plan', provider: 'claude' }
  ]
};

describe('buildScheduledPrompt', () => {
  it('builds a scheduled prompt with repositories, task text, and callback contract', () => {
    const prompt = buildScheduledPrompt({
      profile,
      prompt: 'Summarize the release notes exactly.',
      scheduledFor: new Date(2026, 10, 2, 8, 30),
      repoPaths: ['/a', '/b'],
      outputFile: '/out/2026-11-02-eod.md',
      run: {
        id: 5,
        token: 'token',
        callbackUrl: 'http://127.0.0.1:3005/api/v1'
      }
    });

    expect(prompt).toContain(
      'Scheduled for: 2026-11-02 08:30 (Monday), local time.'
    );
    expect(prompt).toContain(
      "Treat this date as 'today' for any relative dates (yesterday, today, this week) in the task, even if the current time is later."
    );
    expect(prompt).toContain('Repositories (primary first):\n- /a\n- /b');
    expect(prompt).toContain('Summarize the release notes exactly.');
    expect(prompt.indexOf('Repositories (primary first):')).toBeLessThan(
      prompt.indexOf('Summarize the release notes exactly.')
    );
    expect(prompt).toContain(
      'Write the result as markdown to /out/2026-11-02-eod.md (overwrite it).'
    );
    expect(prompt).toContain(
      "curl -fsS -X POST -H 'x-run-token: token' http://127.0.0.1:3005/api/v1/scheduled-runs/5/complete"
    );
    expect(prompt).toContain(
      'Only run the command once, after the file is fully written.'
    );
  });
});
