import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import type { Project as ProjectModel } from '../../../generated/prisma/client';
import type { ProjectRepoEntity } from '../../projects/entities/project-repo.entity';
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

  workspace?: WorkspaceEntity;
  defaultRepo?: ProjectRepoEntity | null;
  repos?: ProjectRepoEntity[];
  tickets?: TicketEntity[];
}
