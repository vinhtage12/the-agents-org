import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway
} from '@nestjs/websockets';

import { HerdrService } from '../services/herdr.service';

import type { Namespace, Socket } from 'socket.io';
import type { Env } from '../../../configuration/env.validation';

const AGENT_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;

@WebSocketGateway({
  namespace: '/api/v1/agents',
  path: '/api/v1/socket.io',
  transports: ['websocket']
})
export class HerdrGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly allowedOrigins: string[];
  private readonly streamStops = new Map<string, () => void>();

  constructor(
    private readonly herdr: HerdrService,
    config: ConfigService<Env, true>
  ) {
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

  async handleConnection(client: Socket) {
    const agentId: unknown = client.handshake.auth?.agentId;
    if (typeof agentId !== 'string' || !AGENT_ID_PATTERN.test(agentId)) {
      client.emit('agent-event', {
        type: 'error',
        message: 'A valid agentId is required in the Socket.IO auth payload'
      });
      client.disconnect(true);
      return;
    }

    try {
      const stop = await this.herdr.openStream(
        agentId,
        event => client.emit('agent-event', event),
        error => {
          const code =
            'code' in error && typeof error.code === 'string'
              ? error.code
              : undefined;
          client.emit('agent-event', {
            type: 'error',
            code,
            message: error.message
          });
          client.disconnect(true);
        }
      );
      if (client.connected) this.streamStops.set(client.id, stop);
      else stop();
    } catch (error) {
      client.emit('agent-event', {
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to open agent stream'
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.streamStops.get(client.id)?.();
    this.streamStops.delete(client.id);
  }
}
