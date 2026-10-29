import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';

export interface UsageWindow {
  label: string;
  usedPercent: number;
  resetsAt: string | null;
}
export interface Usage {
  provider: string;
  status: 'available' | 'unavailable' | 'unsupported' | 'error';
  sampledAt: string | null;
  windows: UsageWindow[];
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseCodexUsage(
  line: string
): Omit<Usage, 'provider' | 'status'> | null {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (
    !record(event) ||
    !record(event.payload) ||
    !record(event.payload.rate_limits)
  )
    return null;
  const limits = event.payload.rate_limits;
  const windows: UsageWindow[] = [];
  for (const key of ['primary', 'secondary']) {
    const window = limits[key];
    if (
      !record(window) ||
      typeof window.used_percent !== 'number' ||
      !Number.isFinite(window.used_percent) ||
      window.used_percent < 0 ||
      window.used_percent > 100
    )
      continue;
    const reset =
      typeof window.resets_at === 'number'
        ? new Date(window.resets_at * 1000)
        : null;
    windows.push({
      label:
        typeof window.window_minutes === 'number'
          ? `${window.window_minutes} min`
          : key,
      usedPercent: window.used_percent,
      resetsAt:
        reset && Number.isFinite(reset.getTime()) ? reset.toISOString() : null
    });
  }
  const timestamp =
    typeof event.timestamp === 'string' ? new Date(event.timestamp) : null;
  if (!windows.length || !timestamp || !Number.isFinite(timestamp.getTime()))
    return null;
  return { windows, sampledAt: timestamp.toISOString() };
}
// Read only a bounded tail; never load conversation contents into API responses.
async function tail(path: string, max = 1024 * 1024) {
  const file = await open(path, 'r');
  try {
    const info = await file.stat();
    const start = Math.max(0, info.size - max);
    const buffer = Buffer.alloc(Math.min(info.size, max));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, start);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    return start ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    await file.close();
  }
}
@Injectable()
export class AgentUsageService {
  private pending?: Promise<{ providers: Usage[] }>;
  private expires = 0;
  usage() {
    if (!this.pending || Date.now() >= this.expires) {
      this.expires = Number.POSITIVE_INFINITY;
      this.pending = this.sample().finally(() => {
        this.expires = Date.now() + 60000;
      });
    }
    return this.pending;
  }
  private async sample() {
    return {
      providers: await Promise.all(
        ['codex', 'claude', 'copilot', 'antigravity'].map(provider =>
          this.provider(provider)
        )
      )
    };
  }
  private async provider(provider: string): Promise<Usage> {
    const empty = (status: Usage['status']): Usage => ({
      provider,
      status,
      windows: [],
      sampledAt: null
    });
    const configured =
      process.env[`${provider.toUpperCase()}_USAGE_CACHE_PATH`];
    try {
      const path =
        configured ?? join(homedir(), `.${provider}`, 'usage-cache.json');
      const info = await stat(path);
      if (info.size > 1024 * 1024) return empty('error');
      const cache: unknown = JSON.parse(await tail(path));
      if (!record(cache) || !Array.isArray(cache.windows))
        return empty('unsupported');
      const windows: UsageWindow[] = cache.windows
        .filter(record)
        .filter(
          w =>
            typeof w.label === 'string' &&
            typeof w.usedPercent === 'number' &&
            Number.isFinite(w.usedPercent) &&
            w.usedPercent >= 0 &&
            w.usedPercent <= 100
        )
        .map(w => ({
          label: String(w.label),
          usedPercent: Number(w.usedPercent),
          resetsAt:
            typeof w.resetsAt === 'string' &&
            Number.isFinite(Date.parse(w.resetsAt))
              ? new Date(w.resetsAt).toISOString()
              : null
        }));
      return windows.length
        ? {
            provider,
            status: 'available',
            windows,
            sampledAt: info.mtime.toISOString()
          }
        : empty('unsupported');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        return empty('error');
      if (configured || provider !== 'codex') return empty('unavailable');
    }
    try {
      const root = join(
        process.env.CODEX_HOME ?? join(homedir(), '.codex'),
        'sessions'
      );
      const candidates: { path: string; mtime: number }[] = [];
      let remaining = 1000;
      const walk = async (dir: string, depth: number): Promise<void> => {
        if (depth > 4 || remaining <= 0) return;
        const entries = (await readdir(dir, { withFileTypes: true })).sort(
          (a, b) => b.name.localeCompare(a.name)
        );
        for (const entry of entries) {
          if (--remaining <= 0) break;
          const path = join(dir, entry.name);
          if (entry.isDirectory()) await walk(path, depth + 1);
          else if (entry.isFile() && entry.name.endsWith('.jsonl'))
            candidates.push({ path, mtime: (await stat(path)).mtimeMs });
        }
      };
      await walk(root, 0);
      let latest: ReturnType<typeof parseCodexUsage> = null;
      for (const file of candidates
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 8)) {
        for (const line of (await tail(file.path)).split('\n')) {
          const parsed = parseCodexUsage(line);
          if (
            parsed &&
            (!latest || (parsed.sampledAt ?? '') > (latest.sampledAt ?? ''))
          )
            latest = parsed;
        }
      }
      return latest
        ? { provider, status: 'available', ...latest }
        : empty('unsupported');
    } catch (error) {
      return empty(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'unavailable'
          : 'error'
      );
    }
  }
}
