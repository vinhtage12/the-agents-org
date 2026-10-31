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
  const skills = [...new Set([...profile.skills, ...ticket.extraSkills])];
  const sections = [
    profile.instructions,
    ticket.extraInstructions,
    skills.length ? `Skills: ${skills.join(', ')}` : '',
    [
      `Ticket ${ticket.jiraKey}: ${ticket.summary}`,
      ticket.jiraUrl,
      '',
      ticket.description
    ].join('\n'),
    `Repository: ${repoPath}`,
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
    [
      'When the spec is final:',
      `1. Write the full spec as markdown to ${run.dir}/output.md (overwrite it).`,
      `2. Run: curl -fsS -X POST -H 'x-run-token: ${run.token}' ${run.callbackUrl}/agent-runs/${run.id}/complete`,
      'Do not run the command before output.md is complete. If it fails, fix the problem and run it again.'
    ].join('\n')
  ];
  return sections.filter(Boolean).join('\n\n');
}
