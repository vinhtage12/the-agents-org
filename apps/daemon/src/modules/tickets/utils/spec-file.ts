import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { BadRequestException } from '@nestjs/common';

export async function resolveSpecFile(
  specDir: string,
  specFile: string
): Promise<string> {
  try {
    if (
      !isAbsolute(specDir) ||
      isAbsolute(specFile) ||
      !specFile.endsWith('.md')
    )
      throw new Error('Invalid file');
    const root = await realpath(specDir);
    const file = await realpath(resolve(root, specFile));
    const path = relative(root, file);
    if (
      path === '..' ||
      path.startsWith(`..${sep}`) ||
      isAbsolute(path) ||
      !(await stat(file)).isFile()
    ) {
      throw new Error('Invalid file');
    }
    return file;
  } catch {
    throw new BadRequestException(
      'Spec file must be an existing .md file inside the spec directory'
    );
  }
}
