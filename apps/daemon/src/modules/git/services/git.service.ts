import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { BadRequestException, Injectable } from '@nestjs/common';

const run = promisify(execFile);

@Injectable()
export class GitService {
  /** No shell: arguments are passed to git as-is. */
  private async git(cwd: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await run('git', args, { cwd });
      return stdout;
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: string };
      const stderr = err.stderr ?? '';
      // ENOENT: git missing, or cwd does not exist.
      if (err.code === 'ENOENT' || /not a git repository/i.test(stderr)) {
        throw new BadRequestException(`Not a git repository: ${cwd}`);
      }
      throw new Error(`git ${args.join(' ')} failed: ${stderr || err.message}`);
    }
  }

  async branches(cwd: string): Promise<string[]> {
    const out = await this.git(cwd, [
      'branch',
      '-a',
      '--format=%(refname:short)'
    ]);
    const names = out
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && l !== 'HEAD' && l !== 'origin/HEAD' && l !== 'origin');
    return [...new Set(names)];
  }

  async currentBranch(cwd: string): Promise<string> {
    return (await this.git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  }

  async isClean(cwd: string): Promise<boolean> {
    return (await this.git(cwd, ['status', '--porcelain'])).trim() === '';
  }

  async assertBranchName(name: string): Promise<void> {
    try {
      await run('git', ['check-ref-format', '--branch', name]);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new BadRequestException('git is not installed');
      }
      throw new BadRequestException(`Invalid branch name: ${name}`);
    }
  }

  async branchExists(cwd: string, name: string): Promise<boolean> {
    for (const ref of [`refs/heads/${name}`, `refs/remotes/origin/${name}`]) {
      try {
        await this.git(cwd, ['rev-parse', '--verify', '--quiet', ref]);
        return true;
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
    }
    return false;
  }

  async createBranch(cwd: string, base: string, name: string): Promise<void> {
    if (base.startsWith('-'))
      throw new BadRequestException('Invalid base branch');
    await this.git(cwd, ['checkout', '-b', name, base]);
  }

  async push(cwd: string, name: string): Promise<void> {
    await this.git(cwd, ['push', '-u', 'origin', name]);
  }
}
