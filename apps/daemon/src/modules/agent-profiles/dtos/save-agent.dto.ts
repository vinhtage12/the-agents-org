import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength
} from 'class-validator';

import { AgentRole } from '../entities/agent.entity';

export const AGENT_PROVIDERS = ['claude', 'codex', 'copilot', 'agy'] as const;

export class SaveAgentDto {
  @IsString() @Length(1, 128) name!: string;
  @IsEnum(AgentRole) role!: AgentRole;
  @IsIn(AGENT_PROVIDERS) provider!: string;
  @IsOptional() @IsString() @MaxLength(128) model?: string | null;
  @IsOptional() @IsString() @MaxLength(32) effort?: string | null;
  @IsString() @Length(1, 1024) path!: string;
  @IsString() @MaxLength(512) description!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^[A-Za-z0-9_*:().-]+$/, { each: true })
  allowedTools!: string[];
  @IsArray() @Type(() => Number) @IsInt({ each: true }) skillIds!: number[];
  @IsArray() @Type(() => Number) @IsInt({ each: true }) ruleIds!: number[];
}
