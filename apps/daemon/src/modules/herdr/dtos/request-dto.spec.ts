import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAgentDto } from './create-agent.dto';
import { SendAgentPromptDto } from './send-agent-prompt.dto';

describe('agent request DTOs', () => {
  it('accepts supported agent kinds and optional pane placement', async () => {
    const dto = plainToInstance(CreateAgentDto, {
      agent: 'antigravity',
      parentPaneId: 'w1:p2',
      direction: 'down'
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true })
    ).resolves.toHaveLength(0);
  });

  it('rejects unsupported kinds, malformed pane ids, and extra fields', async () => {
    const dto = plainToInstance(CreateAgentDto, {
      agent: 'unknown',
      parentPaneId: 'bad pane id',
      direction: 'left',
      extra: true
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });
    expect(errors.map(error => error.property)).toEqual(
      expect.arrayContaining(['agent', 'parentPaneId', 'direction', 'extra'])
    );
  });

  it('requires a non-blank prompt with a maximum length of 30000', async () => {
    const blank = plainToInstance(SendAgentPromptDto, { prompt: '  \n' });
    const tooLong = plainToInstance(SendAgentPromptDto, {
      prompt: 'x'.repeat(30001)
    });

    expect(await validate(blank)).toEqual(
      expect.arrayContaining([expect.any(Object)])
    );
    expect(await validate(tooLong)).toEqual(
      expect.arrayContaining([expect.any(Object)])
    );
    await expect(
      validate(plainToInstance(SendAgentPromptDto, { prompt: 'Review this' }))
    ).resolves.toHaveLength(0);
  });
});
