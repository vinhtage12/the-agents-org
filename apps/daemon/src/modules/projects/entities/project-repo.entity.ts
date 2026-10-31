import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import type { ProjectRepo as ProjectRepoModel } from '../../../generated/prisma/client';
import type { TicketEntity } from '../../tickets/entities/ticket.entity';
import type { ProjectEntity } from '../../workspaces/entities/project.entity';

export class ProjectRepoEntity implements ProjectRepoModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  projectId!: number;

  /** Unique per project. */
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(1024)
  path!: string;

  project?: ProjectEntity;
  defaultFor?: ProjectEntity[];
  tickets?: TicketEntity[];
}
