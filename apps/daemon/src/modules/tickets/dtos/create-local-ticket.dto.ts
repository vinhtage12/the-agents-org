import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';

export class CreateLocalTicketDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 1024)
  summary!: string;

  @IsIn(['Task', 'Bug', 'Story'])
  issueType: string = 'Task';

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1024)
  specFile?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100000)
  description?: string;

  @ValidateIf((_object, value) => value != null)
  @IsInt()
  @Min(1)
  sprintId?: number | null;
}
