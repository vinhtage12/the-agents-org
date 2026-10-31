import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class CreateWorkspaceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 255)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;
}
