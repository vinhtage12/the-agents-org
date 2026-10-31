import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

import type { SpecVersion as SpecVersionModel } from '../../../generated/prisma/client';

export class SpecVersionEntity implements SpecVersionModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  ticketId!: number;

  /** Unique per ticket; increments each time the spec agent rewrites the spec. */
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  feedback!: string | null;

  @IsOptional()
  @IsDate()
  editedAt!: Date | null;

  @IsDate()
  createdAt!: Date;
}
