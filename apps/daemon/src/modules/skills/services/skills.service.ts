import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

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

import { SaveSkillDto } from '../dtos/save-skill.dto';
import { UpdateSkillDto } from '../dtos/update-skill.dto';

async function assertSkillDir(path: string) {
  try {
    if (isAbsolute(path) && (await stat(path)).isDirectory()) return;
  } catch {
    /* Invalid path. */
  }
  throw new BadRequestException('Skill path must be an absolute directory');
}

@Injectable()
export class SkillsService {
  constructor(readonly prisma: PrismaService) {}

  async list({ keyword, provider }: { keyword?: string; provider?: string }) {
    const rows = await this.prisma.skill.findMany({
      where: {
        ...(provider && { provider }),
        ...(keyword && { name: { contains: keyword, mode: 'insensitive' } })
      },
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { agents: true, tickets: { where: OPEN_TICKET } } }
      }
    });
    return {
      data: rows.map(({ _count, ...s }) => ({
        ...s,
        inUse: _count.agents + _count.tickets
      }))
    };
  }

  async get(id: number) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  async create(data: SaveSkillDto) {
    await assertSkillDir(data.path);
    try {
      return await this.prisma.skill.create({ data });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async update(id: number, data: UpdateSkillDto) {
    const skill = await this.get(id);
    // Imported skills start with path ''; any edit must supply a real folder.
    await assertSkillDir(data.path ?? skill.path);
    try {
      return await this.prisma.skill.update({ where: { id }, data });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async remove(id: number) {
    await this.get(id);
    const [agents, tickets] = await Promise.all([
      this.prisma.agent.count({ where: { skills: { some: { id } } } }),
      this.prisma.ticket.count({
        where: { skills: { some: { id } }, ...OPEN_TICKET }
      })
    ]);
    if (agents + tickets > 0)
      throw new ConflictException('Skill is in use by agents or open tickets');
    await this.prisma.skill.delete({ where: { id } });
  }

  async usage(id: number): Promise<IUsage> {
    await this.get(id);
    const [agents, tickets] = await Promise.all([
      this.prisma.agent.findMany({
        where: { skills: { some: { id } } },
        select: { id: true, name: true }
      }),
      this.prisma.ticket.findMany({
        where: { skills: { some: { id } }, ...OPEN_TICKET },
        select: USAGE_TICKET_SELECT
      })
    ]);
    return { projects: [], tickets: toUsageTickets(tickets), agents };
  }

  private rethrow(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    )
      throw new ConflictException(
        'Skill name already exists for this provider'
      );
    throw error;
  }
}
