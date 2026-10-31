import { type PromptBase, outputContract, promptHeader } from './prompt-parts';

export function buildWriteCasesPrompt(
  input: PromptBase & { spec: string }
): string {
  return [
    ...promptHeader(input),
    'Write test cases covering the approved spec, including browser interactions.',
    'Do not modify or create any files in the repository.',
    `Approved spec:\n${input.spec}`,
    outputContract(
      input.run,
      'output.json',
      '{"cases":[{"title":"...","steps":"...","expected":"..."}]}'
    )
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildRunCasesPrompt(
  input: PromptBase & {
    cases: {
      position: number;
      title: string;
      steps: string;
      expected: string;
    }[];
  }
): string {
  return [
    ...promptHeader(input),
    'Start the dev server yourself. Run ALL test cases, including browser interactions, and collect every failure.',
    'Do not modify any code. Do not leave any files in the repository. Stop the dev server when finished.',
    `Test cases:\n${JSON.stringify(input.cases)}`,
    'Report exactly one result for every test case position.',
    outputContract(
      input.run,
      'output.json',
      '{"results":[{"position":1,"passed":true,"detail":""}]}'
    )
  ]
    .filter(Boolean)
    .join('\n\n');
}
