import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateIf
} from 'class-validator';

export class UpdateProjectSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  repoIds?: number[];
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) defaultRepoId?:
    | number
    | null;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) specAgentId?: number | null;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) devAgentId?: number | null;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) testAgentId?: number | null;
}
