import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';

import { CreateWorkspaceDto } from '../dtos/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dtos/update-workspace.dto';
import { ProjectEntity } from '../entities/project.entity';
import { WorkspaceEntity } from '../entities/workspace.entity';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<(WorkspaceEntity & { projects: ProjectEntity[] })[]> {
    return this.prisma.workspace.findMany({
      orderBy: { id: 'asc' },
      include: { projects: { orderBy: { id: 'asc' } } }
    });
  }

  async get(
    id: number
  ): Promise<WorkspaceEntity & { projects: ProjectEntity[] }> {
    if (id <= 0) throw new BadRequestException('ID must be positive');
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { projects: { orderBy: { id: 'asc' } } }
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async create(data: CreateWorkspaceDto): Promise<WorkspaceEntity> {
    try {
      return await this.prisma.workspace.create({ data });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(id: number, data: UpdateWorkspaceDto): Promise<WorkspaceEntity> {
    await this.get(id);
    try {
      return await this.prisma.workspace.update({ where: { id }, data });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async remove(id: number): Promise<void> {
    await this.get(id);
    try {
      await this.prisma.workspace.delete({ where: { id } });
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    )
      throw new ConflictException('Code already exists');
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2003')
        throw new ConflictException(
          'Workspace still contains projects or target workspace no longer exists'
        );
      if (error.code === 'P2025')
        throw new NotFoundException('Workspace or project not found');
    }
    throw error;
  }
}
