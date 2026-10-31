import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { TicketStatus } from '../entities/ticket.entity';

export class MoveTicketDto {
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  @IsEnum(TicketStatus)
  to!: TicketStatus;
}
