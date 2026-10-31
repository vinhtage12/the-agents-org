import { type PromptBase, outputContract, promptHeader } from './prompt-parts';

export interface TestFailure {
  position: number;
  title: string;
  detail: string;
}

export function buildDevPrompt(
  input: PromptBase & {
    spec: string;
    failures?: TestFailure[];
    feedback?: string;
  }
): string {
  return [
    ...promptHeader(input),
    input.failures?.length
      ? 'Task: fix ALL of these failures in one pass.'
      : input.feedback
        ? ''
        : 'Task: implement the approved spec.',
    ...(input.failures ?? []).map(
      f => `#${f.position} ${f.title}: ${f.detail}`
    ),
    input.feedback
      ? `Task: address the owner's feedback.\n${input.feedback}`
      : '',
    `Approved spec:\n${input.spec}`,
    'Do not commit, push or switch branches.',
    outputContract(
      input.run,
      'output.md',
      'a short summary of what you changed'
    )
  ]
    .filter(Boolean)
    .join('\n\n');
}
