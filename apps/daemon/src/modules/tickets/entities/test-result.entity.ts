import { IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';

import type { TestResult as TestResultModel } from '../../../generated/prisma/client';

export class TestResultEntity implements TestResultModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  agentRunId!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  testCaseId!: number;

  @IsBoolean()
  passed!: boolean;

  @IsString()
  detail!: string;
}
