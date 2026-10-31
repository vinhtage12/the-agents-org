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

import {
  AgentRunStatus,
  AgentStep,
  TestMode
} from '../../../generated/prisma/client';

import type { AgentRun as AgentRunModel } from '../../../generated/prisma/client';

export { AgentRunStatus, AgentStep, TestMode };

export class AgentRunEntity implements AgentRunModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  ticketId!: number;

  @ApiProperty({ enum: AgentStep, enumName: 'AgentStep' })
  @IsEnum(AgentStep)
  step!: AgentStep;

  @ApiProperty({ enum: TestMode, enumName: 'TestMode', nullable: true })
  @IsOptional()
  @IsEnum(TestMode)
  testMode!: TestMode | null;

  @IsString()
  @MaxLength(128)
  agentSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  paneId!: string | null;

  /** Secret the agent sends back on completion; never returned by the API. */
  @IsString()
  @MaxLength(64)
  token!: string;

  @ApiProperty({
    enum: AgentRunStatus,
    enumName: 'AgentRunStatus',
    default: AgentRunStatus.RUNNING
  })
  @IsEnum(AgentRunStatus)
  status!: AgentRunStatus;

  @IsOptional()
  @IsString()
  feedback!: string | null;

  @IsOptional()
  @IsString()
  error!: string | null;

  @IsDate()
  startedAt!: Date;

  @IsOptional()
  @IsDate()
  finishedAt!: Date | null;
}
