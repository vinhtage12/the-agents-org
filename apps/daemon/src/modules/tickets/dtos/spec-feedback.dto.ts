import { IsString, Length } from 'class-validator';

export class SpecFeedbackDto {
  @IsString()
  @Length(1, 20000)
  feedback!: string;
}
