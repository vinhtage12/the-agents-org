import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post
} from '@nestjs/common';

import { JiraSyncService } from '../../jira/services/jira-sync.service';
import { LinkTicketsDto } from '../dtos/link-tickets.dto';
import { TicketsService } from '../services/tickets.service';

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
