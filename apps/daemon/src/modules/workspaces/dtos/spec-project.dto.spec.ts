import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateProjectDto } from './create-project.dto';
import { UpdateProjectDto } from './update-project.dto';

describe('project spec DTOs', () => {
  it.each([
    CreateProjectDto,
    UpdateProjectDto
  ])('validates spec fields on %p', async Dto => {
    const base = { name: 'Project', code: 'P' };
    for (const specSource of ['INVALID', null]) {
      expect(
        await validate(
          plainToInstance<CreateProjectDto | UpdateProjectDto, object>(Dto, {
            ...base,
            specSource
          })
        )
      ).not.toHaveLength(0);
    }
    for (const specDir of [123, 'x'.repeat(1025)]) {
      expect(
        await validate(
          plainToInstance<CreateProjectDto | UpdateProjectDto, object>(Dto, {
            ...base,
            specDir
          })
        )
      ).not.toHaveLength(0);
    }
    expect(
      await validate(
        plainToInstance<CreateProjectDto | UpdateProjectDto, object>(Dto, {
          ...base,
          specSource: 'HYBRID',
          specDir: null
        })
      )
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance<CreateProjectDto | UpdateProjectDto, object>(Dto, base)
      )
    ).toHaveLength(0);
  });
});
