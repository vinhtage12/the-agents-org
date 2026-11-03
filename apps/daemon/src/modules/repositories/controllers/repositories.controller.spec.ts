import { Test, TestingModule } from '@nestjs/testing';

import { RepositoriesService } from '../services/repositories.service';
import { RepositoriesController } from './repositories.controller';

describe('RepositoriesController', () => {
  it('resolves its service', async () => {
    const service = {};
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [{ provide: RepositoriesService, useValue: service }]
    }).compile();
    try {
      expect(module.get(RepositoriesController).service).toBe(service);
    } finally {
      await module.close();
    }
  });
});
