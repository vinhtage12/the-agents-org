import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AgentUsageService, parseCodexUsage } from './agent-usage.service';

const event = (timestamp = '2026-10-29T00:00:00Z', percent = 12) =>
  JSON.stringify({
    timestamp,
    payload: {
      rate_limits: {
        primary: {
          used_percent: percent,
          window_minutes: 300,
          resets_at: 1793299793
        },
        secondary: { used_percent: 25, window_minutes: 10080 }
      }
    }
  });
describe('Agent quota', () => {
  let root: string;
  const original = { ...process.env };
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'agent-quota-'));
    process.env.CODEX_HOME = root;
    for (const p of ['CODEX', 'CLAUDE', 'COPILOT', 'ANTIGRAVITY'])
      process.env[`${p}_USAGE_CACHE_PATH`] = join(root, `${p}.json`);
  });
  afterEach(async () => {
    process.env = { ...original };
    await rm(root, { recursive: true, force: true });
  });
  it('parses actual Codex rate-limit events and excludes conversation data', () => {
    expect(parseCodexUsage(event())).toEqual({
      sampledAt: '2026-10-29T00:00:00.000Z',
      windows: [
        {
          label: '300 min',
          usedPercent: 12,
          resetsAt: new Date(1793299793000).toISOString()
        },
        { label: '10080 min', usedPercent: 25, resetsAt: null }
      ]
    });
    expect(parseCodexUsage('broken')).toBeNull();
    expect(parseCodexUsage('{}')).toBeNull();
    expect(parseCodexUsage(event('invalid'))).toBeNull();
    expect(parseCodexUsage(event(undefined, 200))?.windows).toHaveLength(1);
  });
  it('reads the latest native Codex sample and shares cached requests', async () => {
    delete process.env.CODEX_USAGE_CACHE_PATH;
    await mkdir(join(root, 'sessions'), { recursive: true });
    await writeFile(
      join(root, 'sessions', 'test.jsonl'),
      ['broken', event(), event('2026-10-29T01:00:00Z', 14)].join('\n')
    );
    const service = new AgentUsageService();
    const first = service.usage();
    expect(service.usage()).toBe(first);
    expect((await first).providers[0]).toMatchObject({
      status: 'available',
      windows: [expect.objectContaining({ usedPercent: 14 }), expect.anything()]
    });
  });
  it('isolates malformed, absent and unsupported caches per provider', async () => {
    await writeFile(join(root, 'CODEX.json'), '{broken');
    await writeFile(
      join(root, 'CLAUDE.json'),
      JSON.stringify({ windows: [null, { label: 'weekly', usedPercent: 9 }] })
    );
    await writeFile(join(root, 'COPILOT.json'), '{}');
    const { providers } = await new AgentUsageService().usage();
    expect(providers.map(p => p.status)).toEqual([
      'error',
      'available',
      'unsupported',
      'unavailable'
    ]);
  });
});
