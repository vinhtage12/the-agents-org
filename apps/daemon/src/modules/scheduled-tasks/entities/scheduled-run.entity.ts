import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

import { ScheduledRunStatus, ScheduledRunTrigger } from '../enum';

import type { ScheduledRun as ScheduledRunModel } from '#/generated/prisma/client';

export class ScheduledRunEntity implements ScheduledRunModel {
  @IsInt()
  id!: number;

  @IsInt()
  taskId!: number;

  @IsDate()
  scheduledFor!: Date;

  @ApiProperty({ enum: ScheduledRunTrigger, enumName: 'ScheduledRunTrigger' })
  @IsEnum(ScheduledRunTrigger)
  trigger!: ScheduledRunTrigger;

  @ApiProperty({ enum: ScheduledRunStatus, enumName: 'ScheduledRunStatus' })
  @IsEnum(ScheduledRunStatus)
  status!: ScheduledRunStatus;

  @IsOptional()
  @IsInt()
  rerunOfId!: number | null;

  @IsOptional()
  @IsDate()
  dismissedAt!: Date | null;

  @IsOptional()
  @IsInt()
  agentId!: number | null;

  @IsString()
  agentName!: string;

  @IsOptional()
  @IsString()
  paneId!: string | null;

  /** Secret callback credential; never selected for API responses. */
  token!: string;

  @IsOptional()
  @IsString()
  outputPath!: string | null;

  @IsOptional()
  @IsString()
  output!: string | null;

  @IsOptional()
  @IsString()
  error!: string | null;

  @IsOptional()
  @IsDate()
  startedAt!: Date | null;

  @IsOptional()
  @IsDate()
  finishedAt!: Date | null;

  @IsDate()
  createdAt!: Date;
}
