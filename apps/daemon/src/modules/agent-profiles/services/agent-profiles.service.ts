import { stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import {
  IUsage,
  USAGE_TICKET_SELECT,
  toUsageTickets
} from '#common/types/usage';
import { OPEN_TICKET } from '#constants/open-ticket';
import { PrismaService } from '#database/prisma.service';

import { SaveAgentDto } from '../dtos/save-agent.dto';
import { UpdateAgentDto } from '../dtos/update-agent.dto';

import type { AgentRole } from '#/generated/prisma/client';

export type AgentProvider = 'claude' | 'codex' | 'copilot' | 'agy';
/** A legacy `<slug>.md` profile; only AgentImportService reads these. */
export interface AgentProfile {
  slug: string;
  name: string;
  provider: AgentProvider;
  model?: string;
  effort?: string;
  skills: string[];
  instructions: string;
}

export function parseAgentProfile(slug: string, source: string): AgentProfile {
  const match = source
    .replace(/\r\n/g, '\n')
    .match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Missing or invalid frontmatter');
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const field = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!field) throw new Error('Invalid frontmatter line');
    fields[field[1]] = field[2].trim();
  }
  const provider = fields.provider === 'antigravity' ? 'agy' : fields.provider;
  if (!['claude', 'codex', 'copilot', 'agy'].includes(provider))
    throw new Error('Missing or unknown provider');
  return {
    slug,
    name: fields.name || slug,
    provider: provider as AgentProvider,
    model: fields.model || undefined,
    effort: fields.effort || undefined,
    skills: (fields.skills || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    instructions: match[2].trim()
  };
}

const AGENT_REFS = ['Spec', 'Dev', 'Test'] as const;
const anyAgentRef = (id: number) => ({
  OR: AGENT_REFS.map(s => ({ [`${s.toLowerCase()}AgentId`]: id }))
});

@Injectable()
export class AgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ keyword, role }: { keyword?: string; role?: AgentRole }) {
    const rows = await this.prisma.agent.findMany({
      where: {
        ...(role && { role }),
        ...(keyword && { name: { contains: keyword, mode: 'insensitive' } })
      },
      orderBy: { id: 'asc' },
      include: {
        skills: { select: { id: true, name: true, provider: true } },
        rules: { select: { id: true, name: true } },
        _count: {
          select: {
            projectsAsSpec: true,
            projectsAsDev: true,
            projectsAsTest: true,
            ticketsAsSpec: { where: OPEN_TICKET },
            ticketsAsDev: { where: OPEN_TICKET },
            ticketsAsTest: { where: OPEN_TICKET }
          }
        }
      }
    });
    return {
      data: rows.map(({ _count, ...a }) => ({
        ...a,
        inUse: Object.values(_count).reduce((n, c) => n + c, 0)
      }))
    };
  }

  async get(id: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: { skills: true, rules: true }
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  /** null/undefined means "no agent chosen" and is allowed. */
  async assertRole(
    id: number | null | undefined,
    role: AgentRole
  ): Promise<void> {
    if (id == null) return;
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.role !== role)
      throw new BadRequestException(`Agent ${id} is not a ${role} agent`);
  }

  async create(dto: SaveAgentDto) {
    await this.validate(dto);
    const { skillIds, ruleIds, ...rest } = dto;
    return this.prisma.agent.create({
      data: {
        ...rest,
        skills: { connect: skillIds.map(id => ({ id })) },
        rules: { connect: ruleIds.map(id => ({ id })) }
      }
    });
  }

  async update(id: number, dto: UpdateAgentDto) {
    const current = await this.get(id);
    await this.validate({
      provider: current.provider,
      path: current.path,
      skillIds: current.skills.map(s => s.id),
      ...dto
    });
    return this.prisma.agent.update({ where: { id }, data: this.data(dto) });
  }

  async remove(id: number) {
    await this.get(id);
    const [projects, tickets] = await Promise.all([
      this.prisma.project.count({ where: anyAgentRef(id) }),
      this.prisma.ticket.count({
        where: { ...anyAgentRef(id), ...OPEN_TICKET }
      })
    ]);
    if (projects + tickets > 0)
      throw new ConflictException(
        'Agent is in use by projects or open tickets'
      );
    await this.prisma.agent.delete({ where: { id } });
  }

  async usage(id: number): Promise<IUsage> {
    await this.get(id);
    const [projects, tickets] = await Promise.all([
      this.prisma.project.findMany({
        where: anyAgentRef(id),
        select: { id: true, name: true, code: true, workspaceId: true }
      }),
      this.prisma.ticket.findMany({
        where: { ...anyAgentRef(id), ...OPEN_TICKET },
        select: USAGE_TICKET_SELECT
      })
    ]);
    return { projects, tickets: toUsageTickets(tickets), agents: [] };
  }

  /** Fixed file name inside the agent folder: nothing from the client is joined. */
  async avatarPath(id: number): Promise<string> {
    const agent = await this.get(id);
    const file = join(agent.path, 'avatar.png');
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      /* Missing avatar. */
    }
    throw new NotFoundException('Avatar not found');
  }

  private data(dto: UpdateAgentDto) {
    const { skillIds, ruleIds, ...rest } = dto;
    return {
      ...rest,
      ...(skillIds && { skills: { set: skillIds.map(id => ({ id })) } }),
      ...(ruleIds && { rules: { set: ruleIds.map(id => ({ id })) } })
    };
  }

  private async validate(dto: {
    provider?: string;
    path?: string;
    skillIds?: number[];
  }) {
    const { path, provider, skillIds = [] } = dto;
    if (path !== undefined) {
      try {
        if (isAbsolute(path) && (await stat(join(path, 'AGENT.md'))).isFile())
          return this.assertSkills(provider, skillIds);
      } catch {
        /* Falls through to the error. */
      }
      throw new BadRequestException(
        `Agent folder must be an absolute directory containing AGENT.md: ${path}`
      );
    }
    await this.assertSkills(provider, skillIds);
  }

  private async assertSkills(provider: string | undefined, ids: number[]) {
    if (!ids.length) return;
    const skills = await this.prisma.skill.findMany({
      where: { id: { in: ids } }
    });
    if (skills.length !== new Set(ids).size)
      throw new BadRequestException('Unknown skill');
    if (skills.some(s => s.provider !== provider))
      throw new BadRequestException('Skills must match the agent provider');
  }
}
