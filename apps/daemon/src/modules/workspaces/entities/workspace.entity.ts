import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import { ProjectEntity } from './project.entity';

import type { Workspace as WorkspaceModel } from '../../../generated/prisma/client';

export class WorkspaceEntity implements WorkspaceModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsString()
  @MaxLength(255)
  name!: string;

  /** Unique. */
  @IsString()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ type: () => ProjectEntity, isArray: true, required: false })
  projects?: ProjectEntity[];
}
