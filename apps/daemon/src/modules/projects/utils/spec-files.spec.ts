import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listSpecFiles } from './spec-files';

describe('listSpecFiles', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'spec-files-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  it('returns sorted relative markdown files recursively, excluding directories', async () => {
    await mkdir(join(dir, 'sub'));
    await mkdir(join(dir, 'directory.md'));
    await Promise.all(
      ['sub/b.md', 'c.txt', 'a.md'].map(file =>
        writeFile(join(dir, file), 'spec')
      )
    );
    await expect(listSpecFiles(dir)).resolves.toEqual(['a.md', 'sub/b.md']);
  });
});
