import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CLIENT_HEADER, ClientHeaderGuard } from './client-header.guard';

import type { ExecutionContext } from '@nestjs/common';

const context = (
  method: string,
  headers: Record<string, string> = {},
  exempt = false
) => {
  const handler = () => undefined;
  if (exempt) Reflect.defineMetadata('allowWithoutClientHeader', true, handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) })
  } as unknown as ExecutionContext;
};

describe('ClientHeaderGuard', () => {
  const guard = new ClientHeaderGuard(new Reflector());

  it('lets reads through without the header', () => {
    expect(guard.canActivate(context('GET'))).toBe(true);
  });

  it('rejects cross-site style writes without the client header', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(() => guard.canActivate(context(method))).toThrow(
        ForbiddenException
      );
  });

  it('accepts writes from the web client', () => {
    expect(guard.canActivate(context('POST', { [CLIENT_HEADER]: 'web' }))).toBe(
      true
    );
  });

  it('lets exempt routes such as the agent callback through', () => {
    expect(guard.canActivate(context('POST', {}, true))).toBe(true);
  });
});
