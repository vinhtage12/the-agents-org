import { outputContract, promptHeader } from './prompt-parts';

import type { AgentProfile } from '../../agent-profiles/services/agent-profiles.service';

export interface SpecPromptInput {
  profile: AgentProfile;
  ticket: {
    jiraKey: string;
    summary: string;
    description: string;
    jiraUrl: string;
    extraInstructions: string;
    extraSkills: string[];
  };
  repoPath: string;
  run: { id: number; token: string; dir: string; callbackUrl: string };
  previous?: { version: number; content: string; feedback: string };
}

export function buildSpecPrompt({
  profile,
  ticket,
  repoPath,
  run,
  previous
}: SpecPromptInput): string {
  const sections = [
    ...promptHeader({ profile, ticket, repoPath, run }),
    [
      'Task: write the implementation spec for this ticket.',
      'Clarify the purpose, use cases, business rules and scope, and point out conflicts with the existing codebase. Then write the spec, ending with the implementation steps.',
      'Write the spec in Vietnamese.',
      'Do not modify any file in the repository; only read code.',
      'If information is missing, ask the owner before writing.'
    ].join('\n'),
    previous
      ? [
          `Feedback on spec v${previous.version}: ${previous.feedback}`,
          '',
          'Current spec (it may include edits made by the owner; keep them unless the feedback says otherwise):',
          previous.content,
          '',
          'Rewrite the spec to address the feedback.'
        ].join('\n')
      : '',
    outputContract(run, 'output.md', 'the full spec as markdown')
  ];
  return sections.filter(Boolean).join('\n\n');
}
