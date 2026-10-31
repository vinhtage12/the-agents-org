import { PATH_METADATA } from '@nestjs/common/constants';
import { validate } from 'class-validator';

import { FeedbackDto } from '../dtos/feedback.dto';
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
