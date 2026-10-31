import { IsInt, IsString, Length, Min, ValidateIf } from 'class-validator';

export class UpdateProjectSettingsDto {
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) defaultRepoId?:
    | number
    | null;
  @ValidateIf((_, v) => v != null) @IsString() @Length(1, 128) specAgent?:
    | string
    | null;
  @ValidateIf((_, v) => v != null) @IsString() @Length(1, 128) devAgent?:
    | string
    | null;
  @ValidateIf((_, v) => v != null) @IsString() @Length(1, 128) testAgent?:
    | string
    | null;
}
