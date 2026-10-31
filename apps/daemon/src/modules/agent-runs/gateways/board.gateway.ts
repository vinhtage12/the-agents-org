import { ConfigService } from '@nestjs/config';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';

import type { Namespace } from 'socket.io';
import type { Env } from '../../../configuration/env.validation';

@WebSocketGateway({
  namespace: '/api/v1/board',
  path: '/api/v1/socket.io',
  transports: ['websocket']
})
export class BoardGateway implements OnGatewayInit {
  @WebSocketServer()
  private readonly server?: Namespace;
  private readonly allowedOrigins: string[];

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigins = config.get('CORS_ORIGIN', { infer: true });
  }

  afterInit(namespace: Namespace) {
    namespace.use((client, next) => {
      const origin = client.handshake.headers.origin;
      if (origin && !this.allowedOrigins.includes(origin)) {
        next(new Error('Origin not allowed'));
        return;
      }
      next();
    });
  }

  emitChanged(projectId: number) {
    this.server?.emit('board-changed', { projectId });
  }
}
