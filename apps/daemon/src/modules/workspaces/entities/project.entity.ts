import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import { SpecSource } from '../../../generated/prisma/client';

import type { Project as ProjectModel } from '../../../generated/prisma/client';
import type { TicketEntity } from '../../tickets/entities/ticket.entity';
import type { WorkspaceEntity } from './workspace.entity';

export class ProjectEntity implements ProjectModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  workspaceId!: number;

  @IsString()
  @MaxLength(255)
  name!: string;

  /** Unique system-wide; also the ticket prefix. */
  @IsString()
  @MaxLength(32)
  code!: string;

  @ApiProperty({
    enum: SpecSource,
    enumName: 'SpecSource',
    default: SpecSource.JIRA
  })
  @IsEnum(SpecSource)
  specSource!: SpecSource;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  specDir!: string | null;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  localTicketSeq!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  defaultRepoId!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  specAgent!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  devAgent!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  testAgent!: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  specAgentId!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  devAgentId!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  testAgentId!: number | null;

  workspace?: WorkspaceEntity;
  tickets?: TicketEntity[];
}
