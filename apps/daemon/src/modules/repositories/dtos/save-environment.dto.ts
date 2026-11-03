import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsString,
  Length,
  MaxLength,
  ValidateNested
} from 'class-validator';

import { BranchKind } from '../entities/repo-branch.entity';

export class BranchInputDto {
  @IsString() @Length(1, 255) name!: string;
  @IsEnum(BranchKind) kind!: BranchKind;
}

export class SaveEnvironmentDto {
  @IsString() @Length(1, 64) name!: string;
  @IsString() @MaxLength(255) envFile!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchInputDto)
  branches!: BranchInputDto[];
}
