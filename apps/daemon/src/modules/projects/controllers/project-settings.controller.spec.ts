import { Test, TestingModule } from '@nestjs/testing';

import { ProjectsService } from '../services/projects.service';
import { ProjectSettingsController } from './project-settings.controller';

describe('ProjectSettingsController', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [ProjectSettingsController],
      providers: [{ provide: ProjectsService, useValue: {} }]
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('resolves its service', () => {
    expect(module.get(ProjectSettingsController)).toBeDefined();
  });
});
