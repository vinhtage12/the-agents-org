import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';

import { SpecSource } from '../../../generated/prisma/client';
import { UpdateWorkspaceDto } from './update-workspace.dto';

export class UpdateProjectDto extends UpdateWorkspaceDto {
  @ApiProperty({ enum: SpecSource, enumName: 'SpecSource', required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(SpecSource)
  specSource?: SpecSource;

  @ValidateIf((_object, value) => value != null)
  @IsString()
  @MaxLength(1024)
  specDir?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  workspaceId?: number;
}
