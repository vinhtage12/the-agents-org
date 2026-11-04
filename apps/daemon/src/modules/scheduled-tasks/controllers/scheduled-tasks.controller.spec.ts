import { Test, TestingModule } from '@nestjs/testing';

import { ScheduledRunnerService } from '../services/scheduled-runner.service';
import { ScheduledTasksService } from '../services/scheduled-tasks.service';
import { ScheduledTasksController } from './scheduled-tasks.controller';

describe('ScheduledTasksController', () => {
  it('resolves its service', async () => {
    const service = {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      remove: jest.fn()
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduledTasksController],
      providers: [
        { provide: ScheduledTasksService, useValue: service },
        { provide: ScheduledRunnerService, useValue: {} }
      ]
    }).compile();
    try {
      expect(module.get(ScheduledTasksController).service).toBe(service);
    } finally {
      await module.close();
    }
  });

  it('forwards CRUD route arguments to its service', () => {
    const service = {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      remove: jest.fn()
    };
    const runner = { start: jest.fn(), runs: jest.fn() };
    const controller = new ScheduledTasksController(
      service as unknown as ScheduledTasksService,
      runner as unknown as ScheduledRunnerService
    );
    const dto = { name: 'EOD' };

    controller.list();
    controller.create(dto as never);
    controller.get(1);
    controller.update(1, dto as never);
    controller.remove(1);
    controller.run(1);
    controller.runs(1, '1');

    expect(service.list).toHaveBeenCalledWith();
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(service.get).toHaveBeenCalledWith(1);
    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(service.remove).toHaveBeenCalledWith(1);
    expect(runner.start).toHaveBeenCalled();
    expect(runner.runs).toHaveBeenCalledWith(1, 1);
  });
});
