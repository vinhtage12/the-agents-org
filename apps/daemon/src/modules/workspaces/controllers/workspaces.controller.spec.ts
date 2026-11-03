import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../database/prisma.service';
import { WorkspacesController } from './workspaces.controller';

describe('WorkspacesController', () => {
  const prisma = {
    workspace: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    project: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };
  const controller = new WorkspacesController(
    prisma as unknown as PrismaService
  );
  beforeEach(() => jest.resetAllMocks());
  it('creates a workspace', async () => {
    prisma.workspace.create.mockResolvedValue({
      id: 1,
      name: 'Test',
      code: 'T'
    });
    await expect(
      controller.create({ name: 'Test', code: 'T' })
    ).resolves.toEqual({ id: 1, name: 'Test', code: 'T' });
  });
  it('maps unique constraint failures to conflict', async () => {
    prisma.workspace.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      controller.create({ name: 'Test', code: 'T' })
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects projects in missing workspaces', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(
      controller.createProject(1, { name: 'Test', code: 'T' })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });
  it('scopes project lookup to its workspace', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(controller.project(1, 2)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 2, workspaceId: 1 },
      include: { workspace: true }
    });
  });
  it('prevents deleting a nonempty workspace', async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: 1 });
    prisma.workspace.delete.mockRejectedValue({ code: 'P2003' });
    await expect(controller.remove(1)).rejects.toBeInstanceOf(
      ConflictException
    );
  });
  it('does not move a project into a missing target workspace', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 2, workspaceId: 1 });
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(
      controller.updateProject(1, 2, { workspaceId: 3 })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
  it('scopes updates atomically to the original workspace', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 2, workspaceId: 1 });
    prisma.workspace.findUnique.mockResolvedValue({ id: 3 });
    prisma.project.update.mockRejectedValue({ code: 'P2025' });
    await expect(
      controller.updateProject(1, 2, { workspaceId: 3 })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 2, workspaceId: 1 },
      data: { workspaceId: 3 }
    });
  });
});

describe('project spec settings writes', () => {
  let module: TestingModule;
  let controller: WorkspacesController;
  let dir: string;
  const prisma = {
    workspace: { findUnique: jest.fn() },
    project: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'project-spec-'));
    prisma.workspace.findUnique.mockResolvedValue({ id: 1 });
    prisma.project.findFirst.mockResolvedValue({
      id: 2,
      workspaceId: 1,
      specSource: 'LOCAL',
      specDir: dir
    });
    module = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [{ provide: PrismaService, useValue: prisma }]
    }).compile();
    controller = module.get(WorkspacesController);
  });
  afterEach(async () => {
    await module.close();
    await rm(dir, { recursive: true, force: true });
  });
  it('normalizes a local project before creating it', async () => {
    const data = {
      name: 'Test',
      code: 'T',
      specSource: 'LOCAL' as const,
      specDir: ` ${dir} `
    };
    await controller.createProject(1, data);
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { ...data, specDir: dir, workspaceId: 1 }
    });
  });
  it('rejects a missing local spec directory before writing', async () => {
    const data = { name: 'Test', code: 'T', specSource: 'LOCAL' as const };
    await expect(controller.createProject(1, data)).rejects.toMatchObject({
      status: 400
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });
  it('keeps the directory when switching to Jira', async () => {
    const data = { specSource: 'JIRA' as const };
    await controller.updateProject(1, 2, data);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 2, workspaceId: 1 },
      data: { specSource: 'JIRA' }
    });
  });
  it('rejects clearing the current local directory before writing', async () => {
    const data = { specDir: null };
    await expect(controller.updateProject(1, 2, data)).rejects.toMatchObject({
      status: 400
    });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
