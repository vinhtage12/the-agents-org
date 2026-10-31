import { ConflictException } from '@nestjs/common';

import { assertTransition } from './transitions';

describe('assertTransition', () => {
  it('only allows TODO → IN_SPEC in this plan', () => {
    expect(() => assertTransition('TODO', 'IN_SPEC')).not.toThrow();
    expect(() => assertTransition('IN_REVIEW_SPEC', 'IN_PROGRESS')).toThrow(
      ConflictException
    );
    expect(() => assertTransition('IN_SPEC', 'TODO')).toThrow(
      'Cannot move ticket from IN_SPEC to TODO'
    );
    expect(() => assertTransition('TODO', 'DONE')).toThrow(ConflictException);
  });
});
