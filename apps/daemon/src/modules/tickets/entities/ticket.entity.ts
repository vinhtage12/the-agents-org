import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import { TicketStatus } from '../../../generated/prisma/client';

import type { Ticket as TicketModel } from '../../../generated/prisma/client';
import type { ProjectRepoEntity } from '../../projects/entities/project-repo.entity';
import type { ProjectEntity } from '../../workspaces/entities/project.entity';

export { TicketStatus };

export class TicketEntity implements TicketModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  /** Unique. */
  @IsString()
  @MaxLength(64)
  jiraKey!: string;

  @IsString()
  @MaxLength(1024)
  summary!: string;

  @IsString()
  description!: string;

  @IsString()
  @MaxLength(64)
  issueType!: string;

  @IsString()
  @MaxLength(128)
  jiraStatus!: string;

  @IsString()
  @MaxLength(1024)
  jiraUrl!: string;

  @ApiProperty({
    enum: TicketStatus,
    enumName: 'TicketStatus',
    default: TicketStatus.TODO
  })
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  projectId!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  repoId!: number | null;

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
  @IsDate()
  linkedAt!: Date | null;

  @IsOptional()
  @IsDate()
  specApprovedAt!: Date | null;

  @IsString()
  extraInstructions!: string;

  @IsArray()
  @IsString({ each: true })
  extraSkills!: string[];

  @IsInt()
  @Min(0)
  @Max(2147483647)
  fixRound!: number;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  project?: ProjectEntity | null;
  repo?: ProjectRepoEntity | null;
}
