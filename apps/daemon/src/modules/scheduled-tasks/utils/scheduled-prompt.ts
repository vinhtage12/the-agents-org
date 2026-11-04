import { profileHeader } from '../../agent-runs/utils/prompt-parts';

import type { RunAgent } from '../../agent-runs/utils/spec-prompt';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export interface ScheduledPromptInput {
  profile: RunAgent;
  prompt: string;
  scheduledFor: Date;
  repoPaths: string[];
  outputFile: string;
  run: { id: number; token: string; callbackUrl: string };
}

const pad = (value: number) => String(value).padStart(2, '0');

export function buildScheduledPrompt({
  profile,
  prompt,
  scheduledFor,
  repoPaths,
  outputFile,
  run
}: ScheduledPromptInput): string {
  const date = `${scheduledFor.getFullYear()}-${pad(scheduledFor.getMonth() + 1)}-${pad(scheduledFor.getDate())} ${pad(scheduledFor.getHours())}:${pad(scheduledFor.getMinutes())}`;
  return [
    ...profileHeader(profile),
    `Scheduled for: ${date} (${WEEKDAYS[scheduledFor.getDay()]}), local time.`,
    "Treat this date as 'today' for any relative dates (yesterday, today, this week) in the task, even if the current time is later.",
    [
      'Repositories (primary first):',
      ...repoPaths.map(path => `- ${path}`)
    ].join('\n'),
    prompt,
    [
      'When you are finished:',
      `1. Write the result as markdown to ${outputFile} (overwrite it).`,
      `2. Run: curl -fsS -X POST -H 'x-run-token: ${run.token}' ${run.callbackUrl}/scheduled-runs/${run.id}/complete`,
      'Only run the command once, after the file is fully written.'
    ].join('\n')
  ].join('\n\n');
}
