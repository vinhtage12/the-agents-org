import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import type { RepoEnvironment as RepoEnvironmentModel } from '#/generated/prisma/client';
import type { RepoEntity } from './repo.entity';
import type { RepoBranchEntity } from './repo-branch.entity';

export class RepoEnvironmentEntity implements RepoEnvironmentModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  repoId!: number;

  /** Unique per repo. */
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(255)
  envFile!: string;

  repo?: RepoEntity;
  branches?: RepoBranchEntity[];
}
