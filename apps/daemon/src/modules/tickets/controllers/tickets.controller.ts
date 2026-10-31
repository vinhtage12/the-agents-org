import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { JiraSyncService } from '../../jira/services/jira-sync.service';
import { LinkTicketsDto } from '../dtos/link-tickets.dto';
import { TicketsService } from '../services/tickets.service';
import { TicketStatus } from '../entities/ticket.entity';

@Controller()
@ApiTags('tickets')
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
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        tickets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              jiraKey: { type: 'string' },
              summary: { type: 'string' },
              issueType: { type: 'string' },
              jiraUrl: { type: 'string' },
              suggestedProjectId: { type: 'number', nullable: true }
            }
          }
        },
        projects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              code: { type: 'string' },
              workspaceId: { type: 'number' }
            }
          }
        }
      }
    }
  })
  store() {
    return this.tickets.store();
  }
  @Post('tickets/link')
  link(@Body() body: LinkTicketsDto) {
    return this.tickets.link(body.links);
  }
  @Get('projects/:projectId/tickets')
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          jiraKey: { type: 'string' },
          summary: { type: 'string' },
          status: { type: 'string', enum: Object.values(TicketStatus) },
          jiraUrl: { type: 'string' }
        }
      }
    }
  })
  board(
    @Param('projectId', ParseIntPipe) projectId: number
  ): ReturnType<TicketsService['board']> {
    return this.tickets.board(projectId);
  }
}
