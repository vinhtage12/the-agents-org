import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '#database/prisma.service';

import { AgentProfile, parseAgentProfile } from './agent-profiles.service';

import type { AgentRole } from '#/generated/prisma/client';

type Usage = { spec: unknown[]; dev: unknown[]; test: unknown[] };
const STEPS = [
  ['spec', 'BA', 'specAgent'],
  ['dev', 'DEV', 'devAgent'],
  ['test', 'QC', 'testAgent']
] as const;
const SKILL_NOTE = 'Imported: set the skill folder path';

/** One role per place the legacy file was used; unused files become DEV agents. */
export function rolesFor(_slug: string, usage: Usage): AgentRole[] {
  const roles = STEPS.filter(([key]) => usage[key].length > 0).map(
    ([, role]) => role as AgentRole
  );
  return roles.length ? roles : ['DEV'];
}

const skillCommand = (provider: string, name: string) =>
  `${provider === 'codex' ? '$' : '/'}${name}`;

/** One-time move of `<slug>.md` agent files into the agents table and `members/`. */
@Injectable()
export class AgentImportService implements OnModuleInit {
  private readonly logger = new Logger(AgentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    try {
      const { created } = await this.importLegacy();
      if (created) this.logger.log(`Imported ${created} legacy agents`);
    } catch (error) {
      this.logger.error(`Legacy agent import failed: ${String(error)}`);
    }
  }

  async importLegacy(): Promise<{ created: number }> {
    if ((await this.prisma.agent.count()) > 0) return { created: 0 };
    const profiles = await this.readProfiles();
    if (!profiles.length) return { created: 0 };

    const [projects, tickets] = await Promise.all([
      this.prisma.project.findMany({
        select: { specAgent: true, devAgent: true, testAgent: true }
      }),
      this.prisma.ticket.findMany({
        select: {
          id: true,
          specAgent: true,
          devAgent: true,
          testAgent: true,
          extraSkills: true
        }
      })
    ]);
    const usageOf = (slug: string): Usage => {
      const u: Usage = { spec: [], dev: [], test: [] };
      for (const row of [...projects, ...tickets])
        for (const [key, , col] of STEPS) if (row[col] === slug) u[key].push(1);
      return u;
    };

    const membersDir =
      this.config.get<string>('MEMBERS_DIR') ||
      resolve(process.cwd(), '../../members');
    // Files first (never overwritten), then one transaction for the database.
    const plan: { profile: AgentProfile; dir: string; roles: AgentRole[] }[] =
      [];
    for (const profile of profiles) {
      const dir = join(membersDir, profile.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'AGENT.md'), profile.instructions, {
        flag: 'wx'
      }).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== 'EEXIST') throw e;
      });
      plan.push({
        profile,
        dir,
        roles: rolesFor(profile.slug, usageOf(profile.slug))
      });
    }

    const providerOf = new Map(profiles.map(p => [p.slug, p.provider]));
    return this.prisma.$transaction(async tx => {
      const upsertSkill = async (name: string, provider: string) =>
        (
          await tx.skill.upsert({
            where: { provider_name: { provider, name } },
            update: {},
            create: {
              name,
              provider,
              command: skillCommand(provider, name),
              path: '',
              description: SKILL_NOTE
            }
          })
        ).id;

      let created = 0;
      for (const { profile, dir, roles } of plan) {
        const skillIds: number[] = [];
        for (const name of profile.skills)
          skillIds.push(await upsertSkill(name, profile.provider));
        for (const role of roles) {
          const col = STEPS.flatMap(([, r, c]) => (r === role ? [c] : []))[0];
          const agent = await tx.agent.create({
            data: {
              name:
                roles.length > 1 ? `${profile.name} (${role})` : profile.name,
              role,
              provider: profile.provider,
              model: profile.model ?? null,
              effort: profile.effort ?? null,
              path: dir,
              skills: { connect: skillIds.map(id => ({ id })) }
            }
          });
          created++;
          await tx.project.updateMany({
            where: { [col]: profile.slug },
            data: { [`${col}Id`]: agent.id }
          });
          await tx.ticket.updateMany({
            where: { [col]: profile.slug },
            data: { [`${col}Id`]: agent.id }
          });
        }
      }
      for (const t of tickets.filter(t => t.extraSkills.length)) {
        const provider = (t.devAgent && providerOf.get(t.devAgent)) || 'claude';
        const ids: number[] = [];
        for (const name of t.extraSkills)
          ids.push(await upsertSkill(name, provider));
        await tx.ticket.update({
          where: { id: t.id },
          data: { skills: { connect: ids.map(id => ({ id })) } }
        });
      }
      return { created };
    });
  }

  private async readProfiles(): Promise<AgentProfile[]> {
    const dir =
      this.config.get<string>('AGENTS_DIR') ||
      join(homedir(), '.the-agents-org', 'agents');
    let files: string[];
    try {
      files = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const profiles: AgentProfile[] = [];
    for (const file of files.filter(f => f.endsWith('.md')).sort()) {
      try {
        profiles.push(
          parseAgentProfile(
            file.slice(0, -3),
            await readFile(join(dir, file), 'utf8')
          )
        );
      } catch (error) {
        this.logger.warn(`Skipping legacy agent ${file}: ${String(error)}`);
      }
    }
    return profiles;
  }
}
