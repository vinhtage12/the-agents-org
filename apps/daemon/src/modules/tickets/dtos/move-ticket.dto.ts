import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested
} from 'class-validator';

import { TicketStatus } from '../entities/ticket.entity';

export class NewBranchDto {
  @IsString() @Length(1, 255) base!: string;
  @IsString() @Length(1, 255) name!: string;
  @IsBoolean() push!: boolean;
}

export class MoveTicketDto {
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  @IsEnum(TicketStatus)
  to!: TicketStatus;

  /** Needed on the first move to In Progress. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NewBranchDto)
  branch?: NewBranchDto;
}
