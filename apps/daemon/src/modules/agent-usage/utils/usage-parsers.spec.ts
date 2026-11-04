import { parseClaudeUsage } from './claude-usage';
import { parseCopilotUsage } from './copilot-usage';

describe('usage parsers', () => {
  it('parses Claude windows and drops invalid ones', () => {
    expect(
      parseClaudeUsage({
        five_hour: { utilization: 12, resets_at: '2026-11-04T10:00:00Z' },
        seven_day: { utilization: 300, resets_at: null }
      })
    ).toEqual([
      { label: '5h', usedPercent: 12, resetsAt: '2026-11-04T10:00:00.000Z' }
    ]);
    expect(parseClaudeUsage(null)).toEqual([]);
  });
  it('parses Copilot quotas, skipping unlimited and empty ones', () => {
    expect(
      parseCopilotUsage({
        quota_reset_date: '2026-12-01',
        quota_snapshots: {
          chat: { has_quota: true, percent_remaining: 75 },
          premium: { has_quota: false, percent_remaining: 0 },
          completions: {
            has_quota: true,
            unlimited: true,
            percent_remaining: 100
          }
        }
      })
    ).toEqual([
      { label: 'chat', usedPercent: 25, resetsAt: '2026-12-01T00:00:00.000Z' }
    ]);
    expect(parseCopilotUsage(undefined)).toEqual([]);
  });
});
