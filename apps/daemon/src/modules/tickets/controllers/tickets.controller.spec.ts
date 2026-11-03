import { PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateLocalTicketDto } from '../dtos/create-local-ticket.dto';
import { FeedbackDto } from '../dtos/feedback.dto';
import { UpdateLocalTicketDto } from '../dtos/update-local-ticket.dto';
import { TicketsController } from './tickets.controller';

import type { TicketsService } from '../services/tickets.service';

describe('TicketsController flow routes', () => {
  const tickets = {
    feedback: jest.fn(),
    specFeedback: jest.fn(),
    stop: jest.fn(),
    repoConflicts: jest.fn()
  };
  const controller = new TicketsController(
    tickets as unknown as TicketsService,
    {} as never
  );

  it('delegates feedback, spec feedback, stop and conflict lookup', () => {
    controller.feedback(10, { feedback: 'F' });
    controller.specFeedback(10, { feedback: 'S' });
    controller.stop(10);
    controller.repoConflicts(10);
    expect(tickets.feedback).toHaveBeenCalledWith(10, 'F');
    expect(tickets.specFeedback).toHaveBeenCalledWith(10, 'S');
    expect(tickets.stop).toHaveBeenCalledWith(10);
    expect(tickets.repoConflicts).toHaveBeenCalledWith(10);
    expect(Reflect.getMetadata(PATH_METADATA, controller.stop)).toBe(
      'tickets/:id/stop'
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.feedback)).toBe(
      'tickets/:id/feedback'
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.specFeedback)).toBe(
      'tickets/:id/spec/feedback'
    );
  });
  it('validates shared feedback length and type', async () => {
    for (const feedback of ['', 'x'.repeat(20001), 1]) {
      expect(
        (await validate(Object.assign(new FeedbackDto(), { feedback }))).length
      ).toBeGreaterThan(0);
    }
    for (const feedback of ['F', 'x'.repeat(20000)]) {
      expect(
        await validate(Object.assign(new FeedbackDto(), { feedback }))
      ).toHaveLength(0);
    }
  });
});

describe('local ticket routes and DTOs', () => {
  it('delegates create and edit routes', () => {
    const tickets = { createLocal: jest.fn(), updateLocal: jest.fn() };
    const controller = new TicketsController(
      tickets as unknown as TicketsService,
      {} as never
    );
    const body = { summary: 'S', issueType: 'Task', description: 'D' };
    controller.createLocal(3, body);
    controller.updateLocal(10, { specFile: null, description: 'D' });
    expect(tickets.createLocal).toHaveBeenCalledWith(3, body);
    expect(tickets.updateLocal).toHaveBeenCalledWith(10, {
      specFile: null,
      description: 'D'
    });
    expect(Reflect.getMetadata(PATH_METADATA, controller.createLocal)).toBe(
      'projects/:projectId/tickets'
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.updateLocal)).toBe(
      'tickets/:id/local'
    );
  });
  it('defaults issue type and accepts an optional nullable positive int sprint on create', async () => {
    const dto = plainToInstance(CreateLocalTicketDto, {
      summary: ' S ',
      description: 'D'
    });
    expect(dto.issueType).toBe('Task');
    expect(dto.summary).toBe('S');
    expect(await validate(dto)).toHaveLength(0);
    for (const sprintId of [0, -1, '1', 1.5]) {
      expect(
        await validate(
          plainToInstance(CreateLocalTicketDto, {
            summary: 'S',
            description: 'D',
            sprintId
          })
        )
      ).not.toHaveLength(0);
    }
    expect(
      await validate(
        plainToInstance(CreateLocalTicketDto, {
          summary: 'S',
          description: 'D',
          sprintId: null
        })
      )
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateLocalTicketDto, {
          summary: 'S',
          description: 'D',
          sprintId: 4
        })
      )
    ).toHaveLength(0);
  });
  it('validates lengths, types and nullable file edits', async () => {
    for (const invalid of [
      { summary: ' ' },
      { summary: 'x'.repeat(1025) },
      { issueType: 'Epic' },
      { issueType: null },
      { description: 'x'.repeat(100001) },
      { description: null },
      { specFile: 'x'.repeat(1025) }
    ]) {
      expect(
        await validate(
          plainToInstance(CreateLocalTicketDto, { summary: 'S', ...invalid })
        )
      ).not.toHaveLength(0);
      expect(
        await validate(plainToInstance(UpdateLocalTicketDto, invalid))
      ).not.toHaveLength(0);
    }
    expect(
      await validate(plainToInstance(UpdateLocalTicketDto, { specFile: null }))
    ).toHaveLength(0);
    expect(await validate(new UpdateLocalTicketDto())).toHaveLength(0);
  });
});
