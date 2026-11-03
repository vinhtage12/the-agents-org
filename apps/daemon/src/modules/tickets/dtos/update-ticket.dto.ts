import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';

export class UpdateTicketDto {
  @IsOptional() @IsInt() @Min(1) projectId?: number;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) repoId?: number | null;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) specAgentId?: number | null;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) devAgentId?: number | null;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) testAgentId?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  skillIds?: number[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  ruleIds?: number[];
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) sprintId?: number | null;
  @IsOptional() @IsString() @MaxLength(20000) extraInstructions?: string;
}
