import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class UpdateLocalTicketDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 1024)
  summary?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['Task', 'Bug', 'Story'])
  issueType?: string;

  @ValidateIf((_object, value) => value != null)
  @IsString()
  @MaxLength(1024)
  specFile?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100000)
  description?: string;
}
