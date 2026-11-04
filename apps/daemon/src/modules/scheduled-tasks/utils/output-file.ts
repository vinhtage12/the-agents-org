import { homedir } from 'node:os';
import { join } from 'node:path';

const pad = (value: number) => String(value).padStart(2, '0');

export function outputFileName(slug: string, scheduledFor: Date): string {
  const date = `${scheduledFor.getFullYear()}-${pad(scheduledFor.getMonth() + 1)}-${pad(scheduledFor.getDate())}`;
  return `${date}-${slug}.md`;
}

export function expandHome(path: string): string {
  if (path === '~') return homedir();
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}
