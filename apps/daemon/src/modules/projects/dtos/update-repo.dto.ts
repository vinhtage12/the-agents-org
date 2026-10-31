import { IsString, Length, Matches, ValidateIf } from 'class-validator';

export class UpdateRepoDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9._-]+$/)
  name?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Length(1, 1024)
  path?: string;
}
