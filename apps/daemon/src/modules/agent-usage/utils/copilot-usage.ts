import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { COPILOT_USAGE_URL, USAGE_FETCH_TIMEOUT_MS } from '../constants';

import type { UsageWindow } from '../services/agent-usage.service';

const run = promisify(execFile);

export function parseCopilotUsage(body: unknown): UsageWindow[] {
  const data = (body ?? {}) as Record<string, any>;
  const reset = new Date(data.quota_reset_date);
  const resetsAt = Number.isFinite(reset.getTime())
    ? reset.toISOString()
    : null;
  return Object.entries(data.quota_snapshots ?? {}).flatMap(([label, s]) => {
    const left = (s as Record<string, any>)?.percent_remaining;
    const q = s as Record<string, any>;
    if (q?.unlimited || !q?.has_quota) return [];
    if (typeof left !== 'number' || !(left >= 0 && left <= 100)) return [];
    return [{ label, usedPercent: 100 - left, resetsAt }];
  });
}

/** null = no GitHub token (unavailable); throws on HTTP/network failure (error). */
export async function fetchCopilotUsage(): Promise<UsageWindow[] | null> {
  let token: string;
  try {
    token = (
      await run('gh', ['auth', 'token'], { timeout: USAGE_FETCH_TIMEOUT_MS })
    ).stdout.trim();
  } catch {
    return null;
  }
  if (!token) return null;
  const res = await fetch(COPILOT_USAGE_URL, {
    headers: { Authorization: `token ${token}` },
    signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Copilot usage HTTP ${res.status}`);
  return parseCopilotUsage(await res.json());
}
