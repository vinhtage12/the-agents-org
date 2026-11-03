import type { SpecPromptInput } from './spec-prompt';

export type RunContext = SpecPromptInput['run'];
export type PromptBase = Omit<SpecPromptInput, 'previous'>;

export function promptHeader({
  profile,
  ticket,
  repoPath
}: PromptBase): string[] {
  const rules = [
    ...new Set([...profile.rules, ...ticket.rules].map(rule => rule.path))
  ];
  // A skill command only works in its own provider's CLI.
  const skills = new Map(
    [
      ...profile.skills,
      ...ticket.skills.filter(skill => skill.provider === profile.provider)
    ].map(skill => [skill.command, skill])
  );
  return [
    `Read and follow your role description: ${profile.path}/AGENT.md`,
    ticket.extraInstructions,
    rules.length
      ? [
          'Rules (read each before starting):',
          ...rules.map(p => `- ${p}`)
        ].join('\n')
      : '',
    skills.size
      ? [
          'Skills you can use:',
          ...[...skills.values()].map(s => `- ${s.command}: ${s.description}`)
        ].join('\n')
      : '',
    [
      `Ticket ${ticket.jiraKey}: ${ticket.summary}`,
      ticket.jiraUrl,
      '',
      ticket.description
    ].join('\n'),
    `Repository: ${repoPath}`
  ].filter(Boolean);
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
