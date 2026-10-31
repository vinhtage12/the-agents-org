import type { SpecPromptInput } from './spec-prompt';

export type RunContext = SpecPromptInput['run'];
export type PromptBase = Omit<SpecPromptInput, 'previous'>;

export function promptHeader({
  profile,
  ticket,
  repoPath
}: PromptBase): string[] {
  const skills = [...new Set([...profile.skills, ...ticket.extraSkills])];
  return [
    profile.instructions,
    ticket.extraInstructions,
    skills.length ? `Skills: ${skills.join(', ')}` : '',
    [
      `Ticket ${ticket.jiraKey}: ${ticket.summary}`,
      ticket.jiraUrl,
      '',
      ticket.description
    ].join('\n'),
    `Repository: ${repoPath}`
  ];
}

export function outputContract(
  run: RunContext,
  file: 'output.md' | 'output.json',
  what: string
): string {
  return [
    'When you are finished:',
    `1. Write ${what} to ${run.dir}/${file} (overwrite it).`,
    `2. Run: curl -fsS -X POST -H 'x-run-token: ${run.token}' ${run.callbackUrl}/agent-runs/${run.id}/complete`,
    `Do not run the command before ${file} is complete. If it fails, fix the problem and run it again.`
  ].join('\n');
}
