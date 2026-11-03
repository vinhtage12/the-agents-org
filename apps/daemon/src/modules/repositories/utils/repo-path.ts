import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { BadRequestException } from '@nestjs/common';

export async function assertRepoPath(
  path: string,
  what = 'Repo path'
): Promise<void> {
  if (isAbsolute(path)) {
    try {
      if ((await stat(path)).isDirectory()) return;
    } catch {
      /* Invalid path. */
    }
  }
  throw new BadRequestException(
    `${what} must be an absolute existing directory`
  );
}
