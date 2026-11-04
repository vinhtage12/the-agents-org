import { IsArray, IsBoolean, IsDate, IsInt, IsString } from 'class-validator';

import type { ScheduledTask as ScheduledTaskModel } from '#/generated/prisma/client';

export class ScheduledTaskEntity implements ScheduledTaskModel {
  @IsInt()
  id!: number;

  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsString()
  prompt!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  time!: number;

  @IsArray()
  days!: number[];

  @IsInt()
  agentId!: number;

  @IsString()
  outputDir!: string;

  @IsDate()
  checkedUntil!: Date;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;
}
