import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { Prisma } from '#/generated/prisma/client';
import { PrismaService } from '#database/prisma.service';
import { BoardGateway } from '#modules/agent-runs/gateways/board.gateway';

import type { SprintState } from '#/generated/prisma/client';
import type { SprintItem } from '../entities/sprint.entity';

type Db = PrismaService | Prisma.TransactionClient;
type Input = {
  name?: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

const ITEM = {
  id: true,
  source: true,
  name: true,
  state: true,
  startDate: true,
  endDate: true
} as const;
const GROUP: Record<SprintState, number> = { ACTIVE: 0, FUTURE: 1, CLOSED: 2 };
const time = (date: Date | null) => date?.getTime() ?? Infinity;

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardEvents: BoardGateway
  ) {}

  async list(projectId: number): Promise<SprintItem[]> {
    const sprints = await this.prisma.sprint.findMany({
      where: {
        OR: [
          { source: 'LOCAL', projectId },
          { source: 'JIRA', tickets: { some: { projectId } } }
        ]
      },
      select: ITEM
    });
    return sprints.sort(
      (a, b) =>
        GROUP[a.state] - GROUP[b.state] ||
        time(a.startDate) - time(b.startDate) ||
        a.id - b.id
    );
  }

  async create(projectId: number, input: Input): Promise<SprintItem> {
    this.assertDates(input.startDate, input.endDate);
    const sprint = await this.createIn(this.prisma, projectId, input);
    this.boardEvents.emitChanged(projectId);
    return sprint;
  }

  async update(id: number, input: Input): Promise<SprintItem> {
    const sprint = await this.local(id);
    if (sprint.state === 'CLOSED')
      throw new ConflictException('Sprint is closed');
    this.assertDates(
      input.startDate === undefined ? sprint.startDate : input.startDate,
      input.endDate === undefined ? sprint.endDate : input.endDate
    );
    const updated = await this.prisma.sprint.update({
      where: { id },
      data: input,
      select: ITEM
    });
    this.emit(sprint.projectId);
    return updated;
  }

  async remove(id: number): Promise<void> {
    const sprint = await this.local(id);
    if (sprint.state !== 'FUTURE')
      throw new ConflictException('Only future sprints can be deleted');
    await this.prisma.$transaction([
      this.prisma.ticket.updateMany({
        where: { sprintId: id },
        data: { sprintId: null }
      }),
      this.prisma.sprint.delete({ where: { id } })
    ]);
    this.emit(sprint.projectId);
  }

  async start(id: number): Promise<SprintItem> {
    const sprint = await this.local(id);
    if (sprint.state !== 'FUTURE')
      throw new ConflictException('Only future sprints can be started');
    const active = await this.prisma.sprint.findFirst({
      where: { source: 'LOCAL', projectId: sprint.projectId, state: 'ACTIVE' }
    });
    if (active)
      throw new ConflictException('Project already has an active sprint');
    try {
      const started = await this.prisma.sprint.update({
        where: { id },
        data: { state: 'ACTIVE' },
        select: ITEM
      });
      this.emit(sprint.projectId);
      return started;
    } catch (error) {
      // Concurrent start: the partial unique index sprints_one_active_local fired.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Project already has an active sprint');
      throw error;
    }
  }

  async complete(
    id: number,
    target: number | 'new' | 'backlog'
  ): Promise<{
    closed: SprintItem;
    movedTo: SprintItem | null;
    moved: number;
  }> {
    const sprint = await this.local(id);
    if (sprint.state !== 'ACTIVE')
      throw new ConflictException('Only active sprints can be completed');
    let dest: SprintItem | null = null;
    if (typeof target === 'number') {
      const found = await this.prisma.sprint.findUnique({
        where: { id: target }
      });
      if (
        !found ||
        found.source !== 'LOCAL' ||
        found.state !== 'FUTURE' ||
        found.projectId !== sprint.projectId
      )
        throw new BadRequestException(
          'Target must be a future sprint of this project'
        );
      const { id: destId, source, name, state, startDate, endDate } = found;
      dest = { id: destId, source, name, state, startDate, endDate };
    }
    const result = await this.prisma.$transaction(async tx => {
      const movedTo =
        target === 'new'
          ? await this.createIn(tx, sprint.projectId as number, {})
          : dest;
      const { count } = await tx.ticket.updateMany({
        where: {
          sprintId: id,
          projectId: sprint.projectId,
          status: { notIn: ['DONE', 'CANCELED'] }
        },
        data: { sprintId: movedTo?.id ?? null }
      });
      const closed = await tx.sprint.update({
        where: { id },
        data: { state: 'CLOSED', completedAt: new Date() },
        select: ITEM
      });
      return { closed, movedTo, moved: count };
    });
    this.emit(sprint.projectId);
    return result;
  }

  private async createIn(
    db: Db,
    projectId: number,
    input: Input
  ): Promise<SprintItem> {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const count = await db.sprint.count({
      where: { source: 'LOCAL', projectId }
    });
    return db.sprint.create({
      data: {
        source: 'LOCAL',
        projectId,
        state: 'FUTURE',
        name: input.name ?? `${project.code} Sprint ${count + 1}`,
        startDate: input.startDate,
        endDate: input.endDate
      },
      select: ITEM
    });
  }

  private async local(id: number) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) throw new NotFoundException('Sprint not found');
    if (sprint.source !== 'LOCAL')
      throw new ConflictException('Jira sprints are read-only');
    return sprint;
  }

  private assertDates(start?: Date | null, end?: Date | null) {
    if (start && end && end < start)
      throw new BadRequestException('End date must not be before start date');
  }

  private emit(projectId: number | null) {
    if (projectId !== null) this.boardEvents.emitChanged(projectId);
  }
}
