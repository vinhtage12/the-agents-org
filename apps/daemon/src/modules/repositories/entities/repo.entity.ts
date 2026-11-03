import { IsDate, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import type { Repo as RepoModel } from '../../../generated/prisma/client';
import type { TicketEntity } from '../../tickets/entities/ticket.entity';
import type { ProjectEntity } from '../../workspaces/entities/project.entity';
import type { RepoEnvironmentEntity } from './repo-environment.entity';

export class RepoEntity implements RepoModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  /** Unique system-wide. */
  @IsString()
  @MaxLength(64)
  name!: string;

  /** Unique system-wide. */
  @IsString()
  @MaxLength(1024)
  path!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  environments?: RepoEnvironmentEntity[];
  projects?: ProjectEntity[];
  defaultFor?: ProjectEntity[];
  tickets?: TicketEntity[];
}
