import { IsString, Length } from 'class-validator';

export class FeedbackDto {
  @IsString()
  @Length(1, 20000)
  feedback!: string;
}
