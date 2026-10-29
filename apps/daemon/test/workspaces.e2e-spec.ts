import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { WorkspacesController } from '../src/workspaces.controller';

const databaseSuite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
databaseSuite('Workspace API with PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids: number[] = [];
  const suffix = `${Date.now()}`;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            DATABASE_URL: process.env.TEST_DATABASE_URL
          })
        }
      ]
    }).compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    );
    await app.init();
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({ where: { workspaceId: { in: ids } } });
      await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });
  it('creates, nests and reads projects, handles conflicts and missing parents', async () => {
    const server = app.getHttpServer();
    const workspace = (
      await request(server)
        .post('/api/v1/workspaces')
        .send({ name: '  Test workspace  ', code: `WS_${suffix}` })
        .expect(201)
    ).body;
    ids.push(workspace.id);
    expect(workspace.name).toBe('Test workspace');
    const project = (
      await request(server)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .send({ name: 'Project', code: `P_${suffix}` })
        .expect(201)
    ).body;
    expect(project.workspaceId).toBe(workspace.id);
    const tree = (await request(server).get('/api/v1/workspaces').expect(200))
      .body;
    expect(
      tree.find((w: { id: number }) => w.id === workspace.id).projects
    ).toContainEqual(project);
    await request(server).get(`/api/v1/workspaces/${workspace.id}`).expect(200);
    await request(server)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/workspaces/2147483647/projects/${project.id}`)
      .expect(404);
    await request(server)
      .post('/api/v1/workspaces')
      .send({ name: 'Duplicate', code: workspace.code })
      .expect(409);
    await request(server)
      .post(`/api/v1/workspaces/${workspace.id}/projects`)
      .send({ name: 'Duplicate', code: project.code })
      .expect(409);
    await request(server)
      .post('/api/v1/workspaces/2147483647/projects')
      .send({ name: 'Missing', code: `X_${suffix}` })
      .expect(404);
  });
  it('updates, moves and deletes while enforcing workspace ownership and nonempty deletion', async () => {
    const server = app.getHttpServer();
    const create = async (code: string) => {
      const response = await request(server)
        .post('/api/v1/workspaces')
        .send({ name: code, code: `${code}_${suffix}` })
        .expect(201);
      ids.push(response.body.id);
      return response.body;
    };
    const source = await create('SOURCE');
    const target = await create('TARGET');
    await request(server)
      .patch(`/api/v1/workspaces/${source.id}`)
      .send({ name: 'Renamed workspace' })
      .expect(200)
      .expect(res => expect(res.body.name).toBe('Renamed workspace'));
    await request(server)
      .patch(`/api/v1/workspaces/${source.id}`)
      .send({ code: target.code })
      .expect(409);
    await request(server)
      .patch(`/api/v1/workspaces/${source.id}`)
      .send({ name: null })
      .expect(400);
    const project = (
      await request(server)
        .post(`/api/v1/workspaces/${source.id}/projects`)
        .send({ name: 'Move me', code: `MOVE_${suffix}` })
        .expect(201)
    ).body;
    await request(server).delete(`/api/v1/workspaces/${source.id}`).expect(409);
    await request(server)
      .patch(`/api/v1/workspaces/${source.id}/projects/${project.id}`)
      .send({ name: 'Renamed project', workspaceId: target.id })
      .expect(200)
      .expect(res => expect(res.body.workspaceId).toBe(target.id));
    await request(server)
      .get(`/api/v1/workspaces/${source.id}/projects/${project.id}`)
      .expect(404);
    await request(server)
      .delete(`/api/v1/workspaces/${source.id}/projects/${project.id}`)
      .expect(404);
    await request(server)
      .patch(`/api/v1/workspaces/${source.id}/projects/${project.id}`)
      .send({ workspaceId: source.id })
      .expect(404);
    await request(server)
      .patch(`/api/v1/workspaces/${target.id}/projects/${project.id}`)
      .send({ workspaceId: 2147483647 })
      .expect(404);
    await request(server)
      .patch(`/api/v1/workspaces/${target.id}/projects/${project.id}`)
      .send({ workspaceId: 0 })
      .expect(400);
    await request(server)
      .patch(`/api/v1/workspaces/${target.id}/projects/${project.id}`)
      .send({ workspaceId: null })
      .expect(400);
    await request(server)
      .get(`/api/v1/workspaces/${target.id}/projects/${project.id}`)
      .expect(200)
      .expect(res => expect(res.body.name).toBe('Renamed project'));
    const tree = (await request(server).get('/api/v1/workspaces').expect(200))
      .body;
    expect(
      tree.find((w: { id: number }) => w.id === source.id).projects
    ).toHaveLength(0);
    expect(
      tree.find((w: { id: number }) => w.id === target.id).projects
    ).toHaveLength(1);
    await request(server).delete(`/api/v1/workspaces/${source.id}`).expect(204);
    await request(server)
      .delete(`/api/v1/workspaces/${target.id}/projects/${project.id}`)
      .expect(204);
    await request(server)
      .delete(`/api/v1/workspaces/${target.id}/projects/${project.id}`)
      .expect(404);
    await request(server).delete(`/api/v1/workspaces/${target.id}`).expect(204);
    await request(server).get(`/api/v1/workspaces/${target.id}`).expect(404);
  });
  it.each([
    { name: '', code: 'A' },
    { name: '   ', code: 'A' },
    { name: 'Name', code: 'bad code' },
    { name: 'Name', code: 'A', extra: true }
  ])('rejects invalid bodies %j', async body => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .send(body)
      .expect(400);
  });
  it.each(['0', '-1', 'abc'])('rejects invalid ID %s', async id => {
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${id}`)
      .expect(400);
  });
});
