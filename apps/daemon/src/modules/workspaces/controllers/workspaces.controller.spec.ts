import { Test, TestingModule } from '@nestjs/testing';

import { ProjectsService } from '../../projects/services/projects.service';
import { WorkspacesService } from '../services/workspaces.service';
import { WorkspacesController } from './workspaces.controller';

describe('WorkspacesController', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: {} },
        { provide: ProjectsService, useValue: {} }
      ]
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('resolves its services', () => {
    expect(module.get(WorkspacesController)).toBeDefined();
  });
});
