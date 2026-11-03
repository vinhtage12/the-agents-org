import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException } from '@nestjs/common';

import { GitService } from './git.service';

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t'
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env });

describe('GitService', () => {
  const service = new GitService();
  let dir: string;
  let plain: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'git-repo-'));
    plain = await mkdtemp(join(tmpdir(), 'git-plain-'));
    git(dir, 'init', '-b', 'main');
    await writeFile(join(dir, 'a.txt'), 'a');
    git(dir, 'add', '.');
    git(dir, 'commit', '-m', 'init');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(plain, { recursive: true, force: true });
  });

  it('lists local branches', async () => {
    await service.createBranch(dir, 'main', 'feat/FMS-1');
    expect(await service.branches(dir)).toEqual(
      expect.arrayContaining(['main', 'feat/FMS-1'])
    );
  });

  it('creates and checks out a branch', async () => {
    await service.createBranch(dir, 'main', 'feat/FMS-1');
    expect(await service.currentBranch(dir)).toBe('feat/FMS-1');
  });

  it('reports dirty working trees', async () => {
    expect(await service.isClean(dir)).toBe(true);
    await writeFile(join(dir, 'b.txt'), 'b');
    expect(await service.isClean(dir)).toBe(false);
  });

  it('rejects invalid branch names', async () => {
    await expect(service.assertBranchName('feat/a b')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.assertBranchName('feat/x..y')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      service.assertBranchName('feat/x.lock')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.assertBranchName('feat/FMS-1')
    ).resolves.toBeUndefined();
  });

  it('detects existing branches', async () => {
    expect(await service.branchExists(dir, 'main')).toBe(true);
    expect(await service.branchExists(dir, 'nope')).toBe(false);
  });

  it('rejects non-git directories', async () => {
    await expect(service.branches(plain)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
