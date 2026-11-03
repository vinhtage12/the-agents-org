import { assertRepoPath } from '../../repositories/utils/repo-path';

import type { SpecSource } from '../../../generated/prisma/client';

export async function normalizeSpecSettings(
  input: { specSource?: SpecSource; specDir?: string | null },
  current?: { specSource: SpecSource; specDir: string | null }
): Promise<{ specSource?: SpecSource; specDir?: string | null }> {
  const specSource = input.specSource ?? current?.specSource ?? 'JIRA';
  const source =
    input.specSource === undefined ? {} : { specSource: input.specSource };
  if (specSource === 'JIRA') return source;
  const specDir =
    (input.specDir === undefined ? current?.specDir : input.specDir)?.trim() ??
    '';
  await assertRepoPath(specDir, 'Spec directory');
  return { ...source, specDir };
}
