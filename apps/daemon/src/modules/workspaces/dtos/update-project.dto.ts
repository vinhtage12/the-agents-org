import { IsInt, Max, Min, ValidateIf } from 'class-validator';

import { UpdateWorkspaceDto } from './update-workspace.dto';

export class UpdateProjectDto extends UpdateWorkspaceDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  workspaceId?: number;
}
