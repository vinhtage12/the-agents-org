import { IsString, Length } from 'class-validator';

export class UpdateSpecDto {
  @IsString()
  @Length(1, 200000)
  content!: string;
}
