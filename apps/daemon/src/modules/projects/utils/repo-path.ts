import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { BadRequestException } from '@nestjs/common';

export async function assertRepoPath(path: string): Promise<void> {
  if (isAbsolute(path)) {
    try {
      if ((await stat(path)).isDirectory()) return;
    } catch {
      /* Invalid path. */
    }
  }
  throw new BadRequestException(
    'Repo path must be an absolute existing directory'
  );
}
