import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';

import { SpecSource } from '../../../generated/prisma/client';
import { CreateWorkspaceDto } from './create-workspace.dto';

export class CreateProjectDto extends CreateWorkspaceDto {
  @ApiProperty({ enum: SpecSource, enumName: 'SpecSource', required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(SpecSource)
  specSource?: SpecSource;

  @ValidateIf((_object, value) => value != null)
  @IsString()
  @MaxLength(1024)
  specDir?: string | null;
}
