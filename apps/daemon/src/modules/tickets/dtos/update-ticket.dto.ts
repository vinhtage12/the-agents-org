import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';

export class UpdateTicketDto {
  @IsOptional() @IsInt() @Min(1) projectId?: number;
  @ValidateIf((_, v) => v != null) @IsInt() @Min(1) repoId?: number | null;
  @ValidateIf((_, v) => v != null) @IsString() @Length(1, 128) specAgent?:
    | string
    | null;
  @ValidateIf((_, v) => v != null) @IsString() @Length(1, 128) devAgent?:
    | string
    | null;
  @ValidateIf((_, v) => v != null) @IsString() @Length(1, 128) testAgent?:
    | string
    | null;
  @IsOptional() @IsString() @MaxLength(20000) extraInstructions?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^[A-Za-z0-9:._-]{1,128}$/, { each: true })
  extraSkills?: string[];
}
