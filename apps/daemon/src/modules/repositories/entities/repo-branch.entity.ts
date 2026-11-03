import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import { BranchKind } from '#/generated/prisma/client';

import type { RepoBranch as RepoBranchModel } from '#/generated/prisma/client';
import type { RepoEnvironmentEntity } from './repo-environment.entity';

export { BranchKind };

export class RepoBranchEntity implements RepoBranchModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  environmentId!: number;

  /** Denormalized from the environment for the one-checkout-base index. */
  @IsInt()
  @Min(1)
  @Max(2147483647)
  repoId!: number;

  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: BranchKind, enumName: 'BranchKind' })
  @IsEnum(BranchKind)
  kind!: BranchKind;

  environment?: RepoEnvironmentEntity;
}
