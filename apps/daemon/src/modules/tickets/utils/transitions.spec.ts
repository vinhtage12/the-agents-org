import { ConflictException } from '@nestjs/common';

import { assertTransition } from './transitions';

describe('assertTransition', () => {
  it('allows the specified owner moves', () => {
    expect(() => assertTransition('TODO', 'IN_SPEC')).not.toThrow();
    expect(() =>
      assertTransition('IN_REVIEW_SPEC', 'IN_PROGRESS')
    ).not.toThrow();
    expect(() => assertTransition('IN_TESTING', 'IN_REVIEW')).not.toThrow();
    expect(() => assertTransition('IN_REVIEW', 'DONE')).not.toThrow();
    expect(() => assertTransition('IN_SPEC', 'TODO')).toThrow(
      'Cannot move ticket from IN_SPEC to TODO'
    );
    expect(() => assertTransition('TODO', 'DONE')).toThrow(ConflictException);
  });
});
