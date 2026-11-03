import { Test, TestingModule } from '@nestjs/testing';

import { RulesService } from '../services/rules.service';
import { RulesController } from './rules.controller';

describe('RulesController', () => {
  it('resolves its service', async () => {
    const service = {};
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesController],
      providers: [{ provide: RulesService, useValue: service }]
    }).compile();
    try {
      expect(module.get(RulesController).service).toBe(service);
    } finally {
      await module.close();
    }
  });
});
