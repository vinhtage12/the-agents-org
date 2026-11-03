import { Prisma } from '#/generated/prisma/client';

import { SprintsService } from './sprints.service';

const sprint = (over = {}) => ({
  id: 1,
  source: 'LOCAL',
  name: 'S',
  state: 'FUTURE',
  startDate: null,
  endDate: null,
  projectId: 3,
  ...over
});

describe('SprintsService', () => {
  let prisma: any;
  let events: { emitChanged: jest.Mock };
  let service: SprintsService;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 3, code: 'FMS' })
      },
      sprint: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(async ({ data }) => sprint({ id: 9, ...data })),
        update: jest.fn(async ({ data }) => sprint(data)),
        delete: jest.fn().mockResolvedValue(undefined)
      },
      ticket: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma)
      )
    };
    events = { emitChanged: jest.fn() };
    service = new SprintsService(prisma, events as never);
  });

  describe('create', () => {
    it('uses the default name from the LOCAL sprint count', async () => {
      const result = await service.create(3, {});
      expect(prisma.sprint.count).toHaveBeenCalledWith({
        where: { source: 'LOCAL', projectId: 3 }
      });
      expect(prisma.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'LOCAL',
            projectId: 3,
            name: 'FMS Sprint 2',
            state: 'FUTURE'
          })
        })
      );
      expect(result.name).toBe('FMS Sprint 2');
      expect(events.emitChanged).toHaveBeenCalledWith(3);
    });

    it('404 for an unknown project and 400 when end is before start', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(service.create(3, {})).rejects.toMatchObject({
        status: 404
      });
      await expect(
        service.create(3, {
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-01-01')
        })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('JIRA sprints are read-only', () => {
    it.each([
      'update',
      'remove',
      'start'
    ] as const)('%s -> 409', async method => {
      prisma.sprint.findUnique.mockResolvedValue(sprint({ source: 'JIRA' }));
      await expect(service[method](1, {} as never)).rejects.toMatchObject({
        status: 409
      });
    });
    it('complete -> 409', async () => {
      prisma.sprint.findUnique.mockResolvedValue(
        sprint({ source: 'JIRA', state: 'ACTIVE' })
      );
      await expect(service.complete(1, 'backlog')).rejects.toMatchObject({
        status: 409
      });
    });
  });

  describe('update', () => {
    it('409 when CLOSED, otherwise updates and emits', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint({ state: 'CLOSED' }));
      await expect(service.update(1, { name: 'N' })).rejects.toMatchObject({
        status: 409
      });
      prisma.sprint.findUnique.mockResolvedValue(sprint());
      await service.update(1, { name: 'N' });
      expect(prisma.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { name: 'N' } })
      );
      expect(events.emitChanged).toHaveBeenCalledWith(3);
    });
  });

  describe('start', () => {
    beforeEach(() => prisma.sprint.findUnique.mockResolvedValue(sprint()));

    it('409 when the project already has an ACTIVE sprint', async () => {
      prisma.sprint.findFirst.mockResolvedValue(
        sprint({ id: 2, state: 'ACTIVE' })
      );
      await expect(service.start(1)).rejects.toMatchObject({ status: 409 });
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('409 when the unique index raises P2002', async () => {
      prisma.sprint.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x'
        })
      );
      await expect(service.start(1)).rejects.toMatchObject({ status: 409 });
    });

    it('409 when not FUTURE; otherwise activates and emits', async () => {
      prisma.sprint.findUnique.mockResolvedValueOnce(
        sprint({ state: 'ACTIVE' })
      );
      await expect(service.start(1)).rejects.toMatchObject({ status: 409 });
      await service.start(1);
      expect(prisma.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { state: 'ACTIVE' } })
      );
      expect(events.emitChanged).toHaveBeenCalledWith(3);
    });
  });

  describe('remove', () => {
    it('409 when not FUTURE', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint({ state: 'ACTIVE' }));
      await expect(service.remove(1)).rejects.toMatchObject({ status: 409 });
    });
    it('clears tickets then deletes', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint());
      await service.remove(1);
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { sprintId: 1 },
        data: { sprintId: null }
      });
      expect(prisma.sprint.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(events.emitChanged).toHaveBeenCalledWith(3);
    });
  });

  describe('complete', () => {
    const notDone = {
      where: {
        sprintId: 1,
        projectId: 3,
        status: { notIn: ['DONE', 'CANCELED'] }
      }
    };
    beforeEach(() =>
      prisma.sprint.findUnique.mockResolvedValue(sprint({ state: 'ACTIVE' }))
    );

    it('409 when the sprint is not ACTIVE', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint());
      await expect(service.complete(1, 'backlog')).rejects.toMatchObject({
        status: 409
      });
    });

    it("'new' creates a default-named FUTURE sprint and moves open tickets", async () => {
      const result = await service.complete(1, 'new');
      expect(prisma.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'FMS Sprint 2',
            state: 'FUTURE'
          })
        })
      );
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        ...notDone,
        data: { sprintId: 9 }
      });
      expect(prisma.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { state: 'CLOSED', completedAt: expect.any(Date) }
        })
      );
      expect(result.moved).toBe(2);
      expect(result.movedTo).toMatchObject({ id: 9 });
      expect(result.closed).toMatchObject({ state: 'CLOSED' });
      expect(events.emitChanged).toHaveBeenCalledWith(3);
    });

    it("'backlog' sets sprintId null and movedTo null", async () => {
      const result = await service.complete(1, 'backlog');
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        ...notDone,
        data: { sprintId: null }
      });
      expect(result.movedTo).toBeNull();
    });

    it('a numeric target must be a LOCAL FUTURE sprint of the same project', async () => {
      prisma.sprint.findUnique
        .mockResolvedValueOnce(sprint({ state: 'ACTIVE' }))
        .mockResolvedValueOnce(sprint({ id: 5, projectId: 4 }));
      await expect(service.complete(1, 5)).rejects.toMatchObject({
        status: 400
      });
      prisma.sprint.findUnique
        .mockResolvedValueOnce(sprint({ state: 'ACTIVE' }))
        .mockResolvedValueOnce(sprint({ id: 5, state: 'ACTIVE' }));
      await expect(service.complete(1, 5)).rejects.toMatchObject({
        status: 400
      });
      prisma.sprint.findUnique
        .mockResolvedValueOnce(sprint({ state: 'ACTIVE' }))
        .mockResolvedValueOnce(sprint({ id: 5 }));
      const result = await service.complete(1, 5);
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        ...notDone,
        data: { sprintId: 5 }
      });
      expect(result.movedTo).toMatchObject({ id: 5 });
    });
  });

  describe('list', () => {
    it('queries LOCAL of the project and JIRA sprints with project tickets', async () => {
      prisma.sprint.findMany.mockResolvedValue([]);
      await service.list(3);
      expect(prisma.sprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { source: 'LOCAL', projectId: 3 },
              { source: 'JIRA', tickets: { some: { projectId: 3 } } }
            ]
          }
        })
      );
    });

    it('orders ACTIVE, FUTURE, CLOSED, then startDate (nulls last), then id', async () => {
      const d = (s: string) => new Date(s);
      prisma.sprint.findMany.mockResolvedValue([
        sprint({ id: 1, state: 'CLOSED' }),
        sprint({ id: 2, state: 'FUTURE', startDate: null }),
        sprint({ id: 3, state: 'FUTURE', startDate: d('2026-02-01') }),
        sprint({ id: 4, state: 'ACTIVE' }),
        sprint({ id: 5, state: 'FUTURE', startDate: d('2026-02-01') }),
        sprint({ id: 6, state: 'FUTURE', startDate: d('2026-01-01') })
      ]);
      expect((await service.list(3)).map(s => s.id)).toEqual([
        4, 6, 3, 5, 2, 1
      ]);
    });
  });
});
