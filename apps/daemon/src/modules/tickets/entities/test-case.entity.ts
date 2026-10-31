import { IsDate, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import type { TestCase as TestCaseModel } from '../../../generated/prisma/client';

export class TestCaseEntity implements TestCaseModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  ticketId!: number;

  @IsInt()
  @Max(2147483647)
  position!: number;

  @IsString()
  @MaxLength(512)
  title!: string;

  @IsString()
  steps!: string;

  @IsString()
  expected!: string;

  @IsDate()
  createdAt!: Date;
}
