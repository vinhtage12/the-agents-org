import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested
} from 'class-validator';

import { LinkTicketDto } from './link-ticket.dto';

export class LinkTicketsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LinkTicketDto)
  links!: LinkTicketDto[];
}
