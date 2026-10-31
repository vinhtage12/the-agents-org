import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOW_WITHOUT_CLIENT_HEADER } from '../decorators/allow-without-client-header.decorator';

import type { Request } from 'express';

export const CLIENT_HEADER = 'x-agents-org-client';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// A custom header forces a CORS preflight, so other sites cannot forge writes (CSRF).
@Injectable()
export class ClientHeaderGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (
      this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_CLIENT_HEADER, [
        context.getHandler(),
        context.getClass()
      ])
    )
      return true;
    if (request.headers[CLIENT_HEADER]) return true;
    throw new ForbiddenException(`Missing ${CLIENT_HEADER} header`);
  }
}
