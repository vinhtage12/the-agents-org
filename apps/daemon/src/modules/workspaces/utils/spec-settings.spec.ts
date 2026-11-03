import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeSpecSettings } from './spec-settings';

describe('normalizeSpecSettings', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'spec-settings-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  it('requires a directory for LOCAL', async () => {
    await expect(
      normalizeSpecSettings({ specSource: 'LOCAL' })
    ).rejects.toMatchObject({ status: 400 });
  });
  it('trims and accepts an existing HYBRID directory', async () => {
    await expect(
      normalizeSpecSettings({ specSource: 'HYBRID', specDir: ` ${dir} ` })
    ).resolves.toEqual({ specSource: 'HYBRID', specDir: dir });
  });
  it('keeps the stored directory for JIRA', async () => {
    await expect(
      normalizeSpecSettings({ specSource: 'JIRA', specDir: '/x' })
    ).resolves.toEqual({ specSource: 'JIRA' });
  });
  it('rejects relative paths when retaining LOCAL', async () => {
    await expect(
      normalizeSpecSettings(
        { specDir: 'relative' },
        { specSource: 'LOCAL', specDir: dir }
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it.each([
    null,
    '',
    '   '
  ])('rejects clearing a local directory with %j', async specDir => {
    await expect(
      normalizeSpecSettings({ specDir }, { specSource: 'LOCAL', specDir: dir })
    ).rejects.toMatchObject({ status: 400 });
  });
  it('retains current settings for an unrelated update', async () => {
    await expect(
      normalizeSpecSettings({}, { specSource: 'LOCAL', specDir: dir })
    ).resolves.toEqual({ specDir: dir });
  });
  it('uses the current directory when switching to HYBRID', async () => {
    await expect(
      normalizeSpecSettings(
        { specSource: 'HYBRID' },
        { specSource: 'LOCAL', specDir: dir }
      )
    ).resolves.toEqual({ specSource: 'HYBRID', specDir: dir });
  });
  it('defaults new projects to Jira', async () => {
    await expect(normalizeSpecSettings({})).resolves.toEqual({});
  });
  it('rejects missing directories and regular files with a spec-specific message', async () => {
    const file = join(dir, 'file.md');
    await writeFile(file, 'spec');
    for (const specDir of [file, join(dir, 'missing')]) {
      await expect(
        normalizeSpecSettings({ specSource: 'LOCAL', specDir })
      ).rejects.toMatchObject({
        status: 400,
        message: 'Spec directory must be an absolute existing directory'
      });
    }
  });
});
