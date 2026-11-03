import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveSpecFile } from './spec-file';

describe('resolveSpecFile', () => {
  let root: string;
  let dir: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ticket-spec-'));
    dir = join(root, 'specs');
    await mkdir(dir);
    await writeFile(join(dir, 'a.md'), 'spec');
    await writeFile(join(root, 'a.md'), 'outside');
    await symlink(join(root, 'a.md'), join(dir, 'escape.md'));
    await mkdir(join(dir, 'directory.md'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  it('rejects an absent spec directory', async () => {
    await expect(resolveSpecFile('', 'a.md')).rejects.toMatchObject({
      status: 400
    });
  });
  it('resolves a valid markdown file', async () => {
    await expect(resolveSpecFile(dir, 'a.md')).resolves.toBe(
      await realpath(join(dir, 'a.md'))
    );
  });
  it.each([
    '../a.md',
    '/etc/x.md',
    'a.txt',
    'missing.md',
    'escape.md',
    'directory.md'
  ])('rejects %s', async file => {
    await expect(resolveSpecFile(dir, file)).rejects.toMatchObject({
      status: 400
    });
  });
});
