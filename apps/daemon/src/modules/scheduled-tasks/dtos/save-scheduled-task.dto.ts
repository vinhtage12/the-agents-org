import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength
} from 'class-validator';

export class SaveScheduledTaskDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 128)
  name!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1439) time!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days!: number[];
  @Type(() => Number) @IsInt() agentId!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  repoIds!: number[];
  @IsString() @Length(1, 1024) outputDir!: string;
  @IsString() @MinLength(1) prompt!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
