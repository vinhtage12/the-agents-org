import { IsInt, Min, ValidateIf } from 'class-validator';

export class CompleteSprintDto {
  @ValidateIf(o => o.target !== 'new' && o.target !== 'backlog')
  @IsInt()
  @Min(1)
  target!: number | 'new' | 'backlog';
}
