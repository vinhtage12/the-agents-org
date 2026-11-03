import { IsString, Length, MaxLength } from 'class-validator';

export class SaveRuleDto {
  @IsString() @Length(1, 128) name!: string;
  @IsString() @Length(1, 1024) path!: string;
  @IsString() @MaxLength(2000) description!: string;
}
