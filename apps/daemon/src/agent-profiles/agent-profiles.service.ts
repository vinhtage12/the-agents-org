import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AgentProvider = 'claude' | 'codex' | 'copilot' | 'agy';
export interface AgentProfile {
  slug: string;
  name: string;
  provider: AgentProvider;
  model?: string;
  effort?: string;
  skills: string[];
  instructions: string;
}
export interface AgentProfileList {
  profiles: AgentProfile[];
  errors: { file: string; message: string }[];
}
export function parseAgentProfile(slug: string, source: string): AgentProfile {
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Missing or invalid frontmatter');
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const field = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!field) throw new Error('Invalid frontmatter line');
    fields[field[1]] = field[2].trim();
  }
  const provider = fields.provider === 'antigravity' ? 'agy' : fields.provider;
  if (!['claude', 'codex', 'copilot', 'agy'].includes(provider)) throw new Error('Missing or unknown provider');
  return { slug, name: fields.name || slug, provider: provider as AgentProvider, model: fields.model || undefined, effort: fields.effort || undefined, skills: (fields.skills || '').split(',').map(s => s.trim()).filter(Boolean), instructions: match[2].trim() };
}
@Injectable()
export class AgentProfilesService {
  constructor(private readonly config: ConfigService) {}
  async list(): Promise<AgentProfileList> {
    const dir = this.config.get<string>('AGENTS_DIR') || join(homedir(), '.the-agents-org', 'agents');
    const result: AgentProfileList = { profiles: [], errors: [] };
    let files: string[];
    try { files = await readdir(dir); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return result;
      throw error;
    }
    for (const file of files.filter(f => f.endsWith('.md')).sort()) {
      try { result.profiles.push(parseAgentProfile(file.slice(0, -3), await readFile(join(dir, file), 'utf8'))); }
      catch (error) { result.errors.push({ file, message: error instanceof Error ? error.message : String(error) }); }
    }
    return result;
  }
  async get(slug: string): Promise<AgentProfile> {
    const profile = (await this.list()).profiles.find(p => p.slug === slug);
    if (!profile) throw new NotFoundException(`Unknown agent: ${slug}`);
    return profile;
  }
  async assertExists(slugs: (string | null | undefined)[]): Promise<void> {
    const profiles = (await this.list()).profiles;
    for (const slug of slugs) {
      if (slug != null && !profiles.some(p => p.slug === slug)) throw new BadRequestException(`Unknown agent: ${slug}`);
    }
  }
}
