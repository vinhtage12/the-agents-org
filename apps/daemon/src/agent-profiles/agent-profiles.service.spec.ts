import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { AgentProfilesService, parseAgentProfile } from './agent-profiles.service';

describe('parseAgentProfile', () => {
  it('parses frontmatter and body', () => {
    expect(parseAgentProfile('fe-dev', '---\nname: Frontend Developer\nprovider: claude\nmodel: claude-sonnet-5-5\neffort: medium\nskills: a, b:c\n---\nBe careful.\n')).toEqual({ slug: 'fe-dev', name: 'Frontend Developer', provider: 'claude', model: 'claude-sonnet-5-5', effort: 'medium', skills: ['a', 'b:c'], instructions: 'Be careful.' });
  });
  it('normalizes antigravity to agy and defaults name to slug', () => {
    expect(parseAgentProfile('x', '---\nprovider: antigravity\n---\n')).toMatchObject({ name: 'x', provider: 'agy', skills: [] });
  });
  it('rejects missing or unknown provider', () => {
    expect(() => parseAgentProfile('x', '---\nname: X\n---\n')).toThrow('provider');
    expect(() => parseAgentProfile('x', '---\nprovider: gpt\n---\n')).toThrow('provider');
  });
  it('rejects files without frontmatter', () => { expect(() => parseAgentProfile('x', 'hello')).toThrow('frontmatter'); });
});
describe('AgentProfilesService', () => {
  let dir: string;
  let service: AgentProfilesService;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'profiles-'));
    service = new AgentProfilesService(new ConfigService({ AGENTS_DIR: dir }));
    await writeFile(join(dir, 'good.md'), '---\nprovider: codex\n---\nHello');
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
  it('reports invalid files without failing the list', async () => {
    await writeFile(join(dir, 'bad.md'), '---\nname: Bad\n---\n');
    await writeFile(join(dir, 'notes.txt'), 'notes');
    const result = await service.list();
    expect(result.profiles.map(p => p.slug)).toEqual(['good']);
    expect(result.errors).toEqual([{ file: 'bad.md', message: expect.stringContaining('provider') }]);
  });
  it('returns empty when the directory does not exist', async () => {
    service = new AgentProfilesService(new ConfigService({ AGENTS_DIR: join(dir, 'missing') }));
    await expect(service.list()).resolves.toEqual({ profiles: [], errors: [] });
  });
  it('assertExists throws for unknown slug and ignores null', async () => {
    await expect(service.assertExists([null, 'good'])).resolves.toBeUndefined();
    await expect(service.assertExists(['missing'])).rejects.toThrow('Unknown agent: missing');
  });
});
