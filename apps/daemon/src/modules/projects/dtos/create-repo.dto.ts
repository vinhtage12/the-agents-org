import { IsString, Length, Matches } from 'class-validator';

export class CreateRepoDto {
  @IsString() @Length(1, 64) @Matches(/^[A-Za-z0-9._-]+$/) name!: string;
  @IsString() @Length(1, 1024) path!: string;
}
