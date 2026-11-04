import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  CLAUDE_KEYCHAIN_SERVICE,
  CLAUDE_OAUTH_BETA,
  CLAUDE_USAGE_URL,
  USAGE_FETCH_TIMEOUT_MS
} from '../constants';

import type { UsageWindow } from '../services/agent-usage.service';

const run = promisify(execFile);

const WINDOWS = [
  ['five_hour', '5h'],
  ['seven_day', '7d']
] as const;

export function parseClaudeUsage(body: unknown): UsageWindow[] {
  const data = (body ?? {}) as Record<string, any>;
  return WINDOWS.flatMap(([key, label]) => {
    const w = data[key];
    const used = w?.utilization;
    if (typeof used !== 'number' || !(used >= 0 && used <= 100)) return [];
    const reset = new Date(w.resets_at);
    return [
      {
        label,
        usedPercent: used,
        resetsAt: Number.isFinite(reset.getTime()) ? reset.toISOString() : null
      }
    ];
  });
}

function tokenFrom(raw: string): string | null {
  try {
    const oauth = JSON.parse(raw).claudeAiOauth;
    const live = !oauth?.expiresAt || oauth.expiresAt > Date.now();
    return typeof oauth?.accessToken === 'string' && live
      ? oauth.accessToken
      : null;
  } catch {
    return null;
  }
}

/** Credentials file first, then the macOS keychain (where Claude Code refreshes it). */
async function claudeToken(): Promise<string | null> {
  try {
    const token = tokenFrom(
      await readFile(join(homedir(), '.claude', '.credentials.json'), 'utf8')
    );
    if (token) return token;
  } catch {
    /* Fall through to the keychain. */
  }
  if (process.platform !== 'darwin') return null;
  try {
    const { stdout } = await run(
      'security',
      ['find-generic-password', '-s', CLAUDE_KEYCHAIN_SERVICE, '-w'],
      { timeout: USAGE_FETCH_TIMEOUT_MS }
    );
    return tokenFrom(stdout);
  } catch {
    return null;
  }
}

/** null = no usable token (unavailable); throws on HTTP/network failure (error). */
export async function fetchClaudeUsage(): Promise<UsageWindow[] | null> {
  const token = await claudeToken();
  if (!token) return null;
  const res = await fetch(CLAUDE_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      'anthropic-beta': CLAUDE_OAUTH_BETA
    },
    signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Claude usage HTTP ${res.status}`);
  return parseClaudeUsage(await res.json());
}
