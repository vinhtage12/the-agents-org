import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Controller, Get } from '@nestjs/common';

import { AgentUsageService } from './agent-usage.service';

const execute = promisify(execFile);
@Controller('system')
export class SystemController {
  constructor(private readonly agentUsage: AgentUsageService) {}
  private dockerRequest?: ReturnType<typeof sampleDocker>;
  private expires = 0;
  @Get('docker')
  docker() {
    if (!this.dockerRequest || Date.now() > this.expires) {
      this.expires = Number.POSITIVE_INFINITY;
      this.dockerRequest = sampleDocker().finally(() => {
        this.expires = Date.now() + 10000;
      });
    }
    return this.dockerRequest;
  }
  @Get('agent-usage')
  usage() {
    return this.agentUsage.usage();
  }
}

export function parseDockerPercent(value?: string): number | null {
  if (!value || !/^\d+(?:\.\d+)?%$/.test(value.trim())) return null;
  const number = Number(value.trim().slice(0, -1));
  return Number.isFinite(number) ? number : null;
}
export function parseDockerBytes(value?: string): number | null {
  const match = value
    ?.trim()
    .match(/^(\d+(?:\.\d+)?)\s*(B|kB|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/);
  if (!match) return null;
  const scale: Record<string, number> = {
    B: 1,
    kB: 1e3,
    KB: 1e3,
    MB: 1e6,
    GB: 1e9,
    TB: 1e12,
    KiB: 1024,
    MiB: 1024 ** 2,
    GiB: 1024 ** 3,
    TiB: 1024 ** 4
  };
  return Number(match[1]) * scale[match[2]];
}

export async function sampleDocker(
  run: (
    bin: string,
    args: string[],
    options: { timeout: number; maxBuffer: number }
  ) => Promise<{ stdout: string }> = execute
) {
  const sampledAt = new Date().toISOString();
  try {
    const { stdout } = await run(
      'docker',
      ['ps', '-a', '--format', '{{json .}}'],
      { timeout: 5000, maxBuffer: 1024 * 1024 }
    );
    const containers = stdout.trim()
      ? stdout
          .trim()
          .split('\n')
          .map(line => JSON.parse(line) as Record<string, string>)
      : [];
    let stats: Record<string, string>[] = [];
    try {
      if (containers.some(c => c.State === 'running')) {
        const result = await run(
          'docker',
          ['stats', '--no-stream', '--format', '{{json .}}'],
          { timeout: 5000, maxBuffer: 1024 * 1024 }
        );
        stats = result.stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line));
      }
    } catch {
      /* Container status remains available when stats fail. */
    }
    return {
      status: 'available',
      sampledAt,
      containers: containers.map(c => {
        const s = stats.find(s => s.ID === c.ID || s.Name === c.Names);
        const [used, limit] = s?.MemUsage?.split('/') ?? [];
        const memoryUsageBytes = parseDockerBytes(used);
        const memoryLimitBytes = parseDockerBytes(limit);
        return {
          cpuPercent: parseDockerPercent(s?.CPUPerc),
          memoryUsageBytes,
          memoryLimitBytes,
          memoryPercent:
            parseDockerPercent(s?.MemPerc) ??
            (memoryUsageBytes !== null &&
            memoryLimitBytes !== null &&
            memoryLimitBytes > 0
              ? (memoryUsageBytes / memoryLimitBytes) * 100
              : null),
          id: c.ID,
          name: c.Names,
          state: c.State,
          health: c.Status,
          cpu: s?.CPUPerc ?? null,
          memory: s?.MemUsage ?? null
        };
      })
    };
  } catch {
    return { status: 'unavailable', sampledAt, containers: [] };
  }
}
