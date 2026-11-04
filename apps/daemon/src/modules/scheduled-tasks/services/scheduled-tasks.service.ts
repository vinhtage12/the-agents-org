import { isAbsolute } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';
import { AgentProfilesService } from '#modules/agent-profiles/services/agent-profiles.service';
import { assertRepoPath } from '#modules/repositories/utils/repo-path';

import { SaveScheduledTaskDto } from '../dtos/save-scheduled-task.dto';
import { UpdateScheduledTaskDto } from '../dtos/update-scheduled-task.dto';
import { expandHome, nextOccurrence, slugify } from '../utils/schedule';

import type { ScheduledRun, ScheduledTask } from '#/generated/prisma/client';

export type ScheduledTaskView = ScheduledTask & {
  agent: { id: number; name: string };
  repos: { id: number; name: string; path: string }[];
  lastRun: Pick<
    ScheduledRun,
    'id' | 'status' | 'scheduledFor' | 'finishedAt'
  > | null;
  nextRunAt: Date | null;
};

@Injectable()
export class ScheduledTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: AgentProfilesService
  ) {}

  async list(): Promise<ScheduledTaskView[]> {
    const tasks = await this.prisma.scheduledTask.findMany({
      orderBy: { id: 'asc' },
      include: this.viewInclude
    });
    return tasks.map(task => this.toView(task));
  }

  async get(id: number): Promise<ScheduledTaskView> {
    const task = await this.prisma.scheduledTask.findUnique({
      where: { id },
      include: this.viewInclude
    });
    if (!task) throw new NotFoundException('Scheduled task not found');
    return this.toView(task);
  }

  async create(dto: SaveScheduledTaskDto) {
    await this.profiles.get(dto.agentId);
    await this.assertRepos(dto.repoIds);
    const outputDir = this.outputDir(dto.outputDir);
    try {
      return await this.prisma.scheduledTask.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          prompt: dto.prompt,
          enabled: dto.enabled,
          time: dto.time,
          days: dto.days,
          agentId: dto.agentId,
          outputDir,
          checkedUntil: new Date(),
          repos: {
            create: dto.repoIds.map((repoId, position) => ({
              repoId,
              position
            }))
          }
        }
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(id: number, dto: UpdateScheduledTaskDto) {
    const task = await this.find(id);
    if (dto.agentId !== undefined) await this.profiles.get(dto.agentId);
    if (dto.repoIds !== undefined) await this.assertRepos(dto.repoIds);
    const { repoIds, outputDir, name, ...rest } = dto;
    const scheduleChanged =
      (dto.time !== undefined && dto.time !== task.time) ||
      (dto.days !== undefined && !sameDays(dto.days, task.days)) ||
      (task.enabled === false && dto.enabled === true);
    const data = {
      ...rest,
      ...(name !== undefined && { name, slug: slugify(name) }),
      ...(outputDir !== undefined && { outputDir: this.outputDir(outputDir) }),
      ...(scheduleChanged && { checkedUntil: new Date() })
    };
    try {
      if (repoIds === undefined)
        return await this.prisma.scheduledTask.update({ where: { id }, data });
      return await this.prisma.$transaction(async tx => {
        await tx.scheduledTaskRepo.deleteMany({ where: { taskId: id } });
        await tx.scheduledTaskRepo.createMany({
          data: repoIds.map((repoId, position) => ({
            taskId: id,
            repoId,
            position
          }))
        });
        return tx.scheduledTask.update({ where: { id }, data });
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async remove(id: number): Promise<void> {
    await this.find(id);
    const running = await this.prisma.scheduledRun.count({
      where: { taskId: id, status: 'RUNNING' }
    });
    if (running) throw new ConflictException('Scheduled task is running');
    await this.prisma.scheduledTask.delete({ where: { id } });
  }

  private readonly viewInclude = {
    agent: { select: { id: true, name: true } },
    repos: {
      orderBy: { position: 'asc' as const },
      include: { repo: { select: { id: true, name: true, path: true } } }
    },
    runs: {
      orderBy: { scheduledFor: 'desc' as const },
      take: 1,
      select: { id: true, status: true, scheduledFor: true, finishedAt: true }
    }
  };

  private toView(
    task: {
      repos: { repo: { id: number; name: string; path: string } }[];
      runs: Pick<
        ScheduledRun,
        'id' | 'status' | 'scheduledFor' | 'finishedAt'
      >[];
      agent: { id: number; name: string };
    } & ScheduledTask
  ): ScheduledTaskView {
    const { repos, runs, ...scheduledTask } = task;
    return {
      ...scheduledTask,
      repos: repos.map(({ repo }) => repo),
      lastRun: runs[0] ?? null,
      nextRunAt: task.enabled
        ? nextOccurrence({ time: task.time, days: task.days }, new Date())
        : null
    };
  }

  private async find(id: number): Promise<ScheduledTask> {
    const task = await this.prisma.scheduledTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Scheduled task not found');
    return task;
  }

  private async assertRepos(repoIds: number[]): Promise<void> {
    const repos = await this.prisma.repo.findMany({
      where: { id: { in: repoIds } },
      select: { id: true, path: true }
    });
    if (repos.length !== repoIds.length)
      throw new BadRequestException('One or more repos do not exist');
    await Promise.all(repos.map(repo => assertRepoPath(repo.path)));
  }

  private outputDir(value: string): string {
    const outputDir = expandHome(value);
    if (!isAbsolute(outputDir))
      throw new BadRequestException(
        'Output directory must be an absolute path'
      );
    return outputDir;
  }

  private rethrowDuplicate(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2002')
        throw new ConflictException('A task with this name already exists');
    }
    throw error;
  }
}

function sameDays(left: number[], right: number[]): boolean {
  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((day, index) => day === sortedRight[index])
  );
}
