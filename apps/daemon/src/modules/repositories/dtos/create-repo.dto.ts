import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateRepoDto {
  @IsString() @Length(1, 64) @Matches(/^[A-Za-z0-9._-]+$/) name!: string;
  @IsString() @Length(1, 1024) path!: string;
  @IsString() @MaxLength(2000) description!: string;
}
