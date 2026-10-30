import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested
} from 'class-validator';
import { JiraSyncService } from '../jira/jira-sync.service';
import { TicketsService } from './tickets.service';
export class LinkTicketDto {
  @IsInt() @Min(1) ticketId!: number;
  @IsInt() @Min(1) projectId!: number;
}
export class LinkTicketsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LinkTicketDto)
  links!: LinkTicketDto[];
}
@Controller()
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly jiraSync: JiraSyncService
  ) {}
  @Post('tickets/sync')
  sync() {
    return this.jiraSync.sync();
  }
  @Get('tickets/store')
  store() {
    return this.tickets.store();
  }
  @Post('tickets/link')
  link(@Body() body: LinkTicketsDto) {
    return this.tickets.link(body.links);
  }
  @Get('projects/:projectId/tickets')
  board(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.tickets.board(projectId);
  }
}
