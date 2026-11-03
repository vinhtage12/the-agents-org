import { IsIn, IsString, Length, Matches, MaxLength } from 'class-validator';

export const PROVIDERS = ['claude', 'codex', 'copilot', 'agy'] as const;

export class SaveSkillDto {
  @IsString() @Length(1, 128) name!: string;
  @IsIn(PROVIDERS) provider!: string;
  @IsString()
  @Matches(/^[/$][A-Za-z0-9:._-]+$/)
  @MaxLength(128)
  command!: string;
  @IsString() @MaxLength(1024) path!: string;
  @IsString() @MaxLength(2000) description!: string;
}
