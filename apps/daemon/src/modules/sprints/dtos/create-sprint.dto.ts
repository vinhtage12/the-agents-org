import { Type } from 'class-transformer';
import { IsDate, Length, ValidateIf } from 'class-validator';

export class CreateSprintDto {
  @ValidateIf((_, v) => v !== undefined)
  @Length(1, 255)
  name?: string;
  @ValidateIf((_, v) => v != null)
  @Type(() => Date)
  @IsDate()
  startDate?: Date | null;
  @ValidateIf((_, v) => v != null)
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;
}
