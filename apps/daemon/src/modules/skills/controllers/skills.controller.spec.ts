import { Test, TestingModule } from '@nestjs/testing';

import { SkillsService } from '../services/skills.service';
import { SkillsController } from './skills.controller';

describe('SkillsController', () => {
  it('resolves its service', async () => {
    const service = {};
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillsController],
      providers: [{ provide: SkillsService, useValue: service }]
    }).compile();
    try {
      expect(module.get(SkillsController).service).toBe(service);
    } finally {
      await module.close();
    }
  });
});
