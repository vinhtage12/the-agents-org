import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import { SprintSource, SprintState } from '#/generated/prisma/client';

import type { Sprint as SprintModel } from '#/generated/prisma/client';

export class SprintEntity implements SprintModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @ApiProperty({ enum: SprintSource, enumName: 'SprintSource' })
  @IsEnum(SprintSource)
  source!: SprintSource;

  @IsOptional()
  @IsInt()
  jiraSprintId!: number | null;

  @IsOptional()
  @IsInt()
  jiraBoardId!: number | null;

  /** Only set for LOCAL sprints. */
  @IsOptional()
  @IsInt()
  projectId!: number | null;

  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: SprintState, enumName: 'SprintState' })
  @IsEnum(SprintState)
  state!: SprintState;

  @IsOptional()
  @IsDate()
  startDate!: Date | null;

  @IsOptional()
  @IsDate()
  endDate!: Date | null;

  @IsOptional()
  @IsDate()
  completedAt!: Date | null;

  @IsDate()
  createdAt!: Date;
}

export type SprintItem = Pick<
  SprintEntity,
  'id' | 'source' | 'name' | 'state' | 'startDate' | 'endDate'
>;
