import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SendAgentPromptDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(30000)
  prompt!: string;
}
