import { IsInt, Min } from 'class-validator';

export class LinkTicketDto {
  @IsInt() @Min(1) ticketId!: number;
  @IsInt() @Min(1) projectId!: number;
}
