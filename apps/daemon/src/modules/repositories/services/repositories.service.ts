import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { OPEN_TICKET } from '../../../common/constants/open-ticket';
import { IUsage } from '../../../common/types/usage';
import { PrismaService } from '../../../database/prisma.service';
import { GitService } from '../../git/services/git.service';
import { CreateRepoDto } from '../dtos/create-repo.dto';
import { SaveEnvironmentDto } from '../dtos/save-environment.dto';
import { UpdateRepoDto } from '../dtos/update-repo.dto';
import { assertRepoPath } from '../utils/repo-path';

const CHECKOUT_BASE_MSG = 'Only one checkout base branch per repo';

@Injectable()
export class RepositoriesService {
  constructor(
    readonly prisma: PrismaService,
    private readonly git: GitService
  ) {}

  async list(keyword?: string) {
    const contains = keyword
      ? { contains: keyword, mode: 'insensitive' as const }
      : undefined;
    const rows = await this.prisma.repo.findMany({
      where: contains
        ? { OR: [{ name: contains }, { path: contains }] }
        : undefined,
      orderBy: { id: 'asc' },
      include: {
        environments: { select: { name: true }, orderBy: { id: 'asc' } },
        _count: { select: { projects: true, tickets: { where: OPEN_TICKET } } }
      }
    });
    return {
      data: rows.map(({ environments, _count, ...repo }) => ({
        ...repo,
        environments: environments.map(e => e.name),
        inUse: _count.projects + _count.tickets
      }))
    };
  }

  async get(id: number) {
    const repo = await this.prisma.repo.findUnique({
      where: { id },
      include: {
        environments: {
          orderBy: { id: 'asc' },
          include: { branches: { orderBy: { id: 'asc' } } }
        }
      }
    });
    if (!repo) throw new NotFoundException('Repo not found');
    return repo;
  }

  async create(data: CreateRepoDto) {
    await assertRepoPath(data.path);
    try {
      return await this.prisma.repo.create({ data });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async update(id: number, data: UpdateRepoDto) {
    await this.get(id);
    if (data.path !== undefined) await assertRepoPath(data.path);
    try {
      return await this.prisma.repo.update({ where: { id }, data });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async remove(id: number) {
    await this.get(id);
    const [projects, tickets] = await Promise.all([
      this.prisma.project.count({ where: { repos: { some: { id } } } }),
      this.prisma.ticket.count({ where: { repoId: id, ...OPEN_TICKET } })
    ]);
    if (projects + tickets > 0)
      throw new ConflictException('Repo is in use by projects or open tickets');
    await this.prisma.repo.delete({ where: { id } });
  }

  async createEnvironment(repoId: number, dto: SaveEnvironmentDto) {
    await this.get(repoId);
    try {
      return await this.prisma.$transaction(async tx => {
        const env = await tx.repoEnvironment.create({
          data: { repoId, name: dto.name, envFile: dto.envFile }
        });
        await tx.repoBranch.createMany({
          data: dto.branches.map(b => ({
            environmentId: env.id,
            repoId,
            name: b.name,
            kind: b.kind
          }))
        });
        return env;
      });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async updateEnvironment(
    repoId: number,
    envId: number,
    dto: SaveEnvironmentDto
  ) {
    const env = await this.prisma.repoEnvironment.findFirst({
      where: { id: envId, repoId }
    });
    if (!env) throw new NotFoundException('Environment not found');
    try {
      return await this.prisma.$transaction(async tx => {
        const updated = await tx.repoEnvironment.update({
          where: { id: envId },
          data: { name: dto.name, envFile: dto.envFile }
        });
        await tx.repoBranch.deleteMany({ where: { environmentId: envId } });
        await tx.repoBranch.createMany({
          data: dto.branches.map(b => ({
            environmentId: envId,
            repoId,
            name: b.name,
            kind: b.kind
          }))
        });
        return updated;
      });
    } catch (e) {
      this.rethrow(e);
    }
  }

  async removeEnvironment(repoId: number, envId: number) {
    const env = await this.prisma.repoEnvironment.findFirst({
      where: { id: envId, repoId }
    });
    if (!env) throw new NotFoundException('Environment not found');
    await this.prisma.repoEnvironment.delete({ where: { id: envId } });
  }

  async gitBranches(id: number, keyword?: string) {
    const repo = await this.get(id);
    const names = await this.git.branches(repo.path);
    const needle = keyword?.toLowerCase();
    const base =
      repo.environments
        .flatMap(e => e.branches)
        .find(b => b.kind === 'CHECKOUT_BASE')?.name ?? null;
    return {
      data: names
        .filter(n => !needle || n.toLowerCase().includes(needle))
        .map(label => ({ label })),
      base
    };
  }

  async usage(id: number): Promise<IUsage> {
    await this.get(id);
    const [projects, tickets] = await Promise.all([
      this.prisma.project.findMany({
        where: { repos: { some: { id } } },
        select: { id: true, name: true, code: true, workspaceId: true }
      }),
      this.prisma.ticket.findMany({
        where: { repoId: id, ...OPEN_TICKET },
        select: {
          id: true,
          jiraKey: true,
          projectId: true,
          project: { select: { workspaceId: true } }
        }
      })
    ]);
    return {
      projects,
      tickets: tickets.map(({ project, ...t }) => ({
        ...t,
        workspaceId: project?.workspaceId ?? null
      })),
      agents: []
    };
  }

  private rethrow(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const e = error as { code: string; meta?: unknown };
      if (e.code === 'P2002') {
        const text = JSON.stringify(e.meta ?? {});
        if (text.includes('one_checkout_base'))
          throw new ConflictException(CHECKOUT_BASE_MSG);
        if (text.includes('repos_'))
          throw new ConflictException('Repo name or path already exists');
        throw new ConflictException('Name already exists');
      }
    }
    throw error;
  }
}
