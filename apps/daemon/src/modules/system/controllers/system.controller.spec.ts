import { Test, TestingModule } from '@nestjs/testing';

import { SystemService } from '../services/system.service';
import { SystemController } from './system.controller';

describe('SystemController', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [{ provide: SystemService, useValue: {} }]
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('resolves its service', () => {
    expect(module.get(SystemController)).toBeDefined();
  });
});
