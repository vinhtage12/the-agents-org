import { Test, TestingModule } from '@nestjs/testing';

import { SprintsService } from '../services/sprints.service';
import { SprintsController } from './sprints.controller';

describe('SprintsController', () => {
  it('delegates routes to the service', async () => {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue({ id: 1 }),
      complete: jest.fn().mockResolvedValue({ moved: 0 })
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SprintsController],
      providers: [{ provide: SprintsService, useValue: service }]
    }).compile();
    try {
      const controller = module.get(SprintsController);
      await controller.list(3);
      await controller.create(3, { name: 'N' });
      await controller.update(1, { name: 'M' });
      await controller.remove(1);
      await controller.start(1);
      await controller.complete(1, { target: 'new' });
      expect(service.list).toHaveBeenCalledWith(3);
      expect(service.create).toHaveBeenCalledWith(3, { name: 'N' });
      expect(service.update).toHaveBeenCalledWith(1, { name: 'M' });
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(service.start).toHaveBeenCalledWith(1);
      expect(service.complete).toHaveBeenCalledWith(1, 'new');
    } finally {
      await module.close();
    }
  });
});
