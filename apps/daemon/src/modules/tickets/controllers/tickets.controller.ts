import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { JiraSyncService } from '../../jira/services/jira-sync.service';
import { LinkTicketsDto } from '../dtos/link-tickets.dto';
import { MoveTicketDto } from '../dtos/move-ticket.dto';
import { SpecFeedbackDto } from '../dtos/spec-feedback.dto';
import { UpdateSpecDto } from '../dtos/update-spec.dto';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import { TicketStatus } from '../entities/ticket.entity';
import { TicketsService } from '../services/tickets.service';

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
          jiraUrl: { type: 'string' },
          label: {
            type: 'string',
            enum: ['running', 'approved', 'needs_you'],
            nullable: true
          },
          specVersion: { type: 'number', nullable: true }
        }
      }
    }
  })
  board(
    @Param('projectId', ParseIntPipe) projectId: number
  ): ReturnType<TicketsService['board']> {
    return this.tickets.board(projectId);
  }
  @Get('tickets/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.tickets.detail(id);
  }
  @Patch('tickets/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTicketDto) {
    return this.tickets.update(id, body);
  }
  @Post('tickets/:id/move')
  move(@Param('id', ParseIntPipe) id: number, @Body() body: MoveTicketDto) {
    return this.tickets.move(id, body.to);
  }
  @Put('tickets/:id/spec')
  saveSpec(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSpecDto) {
    return this.tickets.saveSpec(id, body.content);
  }
  @Post('tickets/:id/spec/feedback')
  feedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SpecFeedbackDto
  ) {
    return this.tickets.feedback(id, body.feedback);
  }
  @Post('tickets/:id/spec/stop')
  stopSpec(@Param('id', ParseIntPipe) id: number) {
    return this.tickets.stopSpec(id);
  }
  @Post('tickets/:id/spec/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.tickets.approve(id);
  }
}
