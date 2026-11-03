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

import { SaveRuleDto } from '../dtos/save-rule.dto';
import { UpdateRuleDto } from '../dtos/update-rule.dto';

async function assertRuleFile(path: string) {
  try {
    if (isAbsolute(path) && (await stat(path)).isFile()) return;
  } catch {
    /* Invalid path. */
  }
  throw new BadRequestException('Rule path must be an absolute file');
}

@Injectable()
export class RulesService {
  constructor(readonly prisma: PrismaService) {}

  async list({ keyword }: { keyword?: string }) {
    const rows = await this.prisma.rule.findMany({
      where: keyword
        ? { name: { contains: keyword, mode: 'insensitive' } }
        : {},
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { agents: true, tickets: { where: OPEN_TICKET } } }
      }
    });
    return {
      data: rows.map(({ _count, ...r }) => ({
        ...r,
        inUse: _count.agents + _count.tickets
      }))
    };
  }

  async get(id: number) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async create(data: SaveRuleDto) {
    await assertRuleFile(data.path);
    try {
      return await this.prisma.rule.create({ data });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async update(id: number, data: UpdateRuleDto) {
    await this.get(id);
    if (data.path !== undefined) await assertRuleFile(data.path);
    try {
      return await this.prisma.rule.update({ where: { id }, data });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async remove(id: number) {
    await this.get(id);
    const [agents, tickets] = await Promise.all([
      this.prisma.agent.count({ where: { rules: { some: { id } } } }),
      this.prisma.ticket.count({
        where: { rules: { some: { id } }, ...OPEN_TICKET }
      })
    ]);
    if (agents + tickets > 0)
      throw new ConflictException('Rule is in use by agents or open tickets');
    await this.prisma.rule.delete({ where: { id } });
  }

  async usage(id: number): Promise<IUsage> {
    await this.get(id);
    const [agents, tickets] = await Promise.all([
      this.prisma.agent.findMany({
        where: { rules: { some: { id } } },
        select: { id: true, name: true }
      }),
      this.prisma.ticket.findMany({
        where: { rules: { some: { id } }, ...OPEN_TICKET },
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
      throw new ConflictException('Rule name already exists');
    throw error;
  }
}
