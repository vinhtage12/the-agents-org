import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import { AgentRole } from '../../../generated/prisma/client';

import type { Agent as AgentModel } from '../../../generated/prisma/client';

export { AgentRole };

export class AgentEntity implements AgentModel {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;

  @IsString()
  @MaxLength(128)
  name!: string;

  @ApiProperty({ enum: AgentRole, enumName: 'AgentRole' })
  @IsEnum(AgentRole)
  role!: AgentRole;

  /** claude | codex | copilot | agy */
  @IsString()
  @MaxLength(16)
  provider!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  model!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  effort!: string | null;

  /** Folder holding AGENT.md (and avatar.png). */
  @IsString()
  @MaxLength(1024)
  path!: string;

  @IsString()
  @MaxLength(512)
  description!: string;

  @IsArray()
  @IsString({ each: true })
  allowedTools!: string[];
}
