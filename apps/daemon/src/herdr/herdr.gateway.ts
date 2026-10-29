import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket, WebSocketServer } from 'ws';

import { HerdrService } from './herdr.service';

import type { IncomingMessage, Server } from 'node:http';
import type { Env } from '../configuration/env.validation';

@Injectable()
export class HerdrGateway implements OnModuleInit, OnModuleDestroy {
  private readonly wss = new WebSocketServer({ noServer: true });
  private httpServer?: Server;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly herdr: HerdrService,
    config: ConfigService<Env, true>
  ) {
    this.allowedOrigins = config.get('CORS_ORIGIN', { infer: true });
  }

  private readonly allowedOrigins: string[];

  onModuleInit() {
    this.httpServer = this.adapterHost.httpAdapter.getHttpServer() as Server;
    this.httpServer.on('upgrade', this.handleUpgrade);
  }

  onModuleDestroy() {
    this.httpServer?.off('upgrade', this.handleUpgrade);
    for (const client of this.wss.clients)
      client.close(1001, 'Daemon shutting down');
    this.wss.close();
  }

  private readonly handleUpgrade = (
    request: IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer
  ) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const match = pathname.match(/^\/api\/v1\/agents\/([^/]+)\/events$/);
    if (!match) return;
    const origin = request.headers.origin;
    if (origin && !this.allowedOrigins.includes(origin)) {
      socket.destroy();
      return;
    }

    let id: string;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      socket.destroy();
      return;
    }
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(id)) {
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, ws => {
      this.wss.emit('connection', ws, request, id);
      void this.connectAgent(ws, id);
    });
  };

  private async connectAgent(ws: WebSocket, id: string) {
    let stop: (() => void) | undefined;
    ws.once('close', () => stop?.());
    ws.once('error', () => stop?.());

    try {
      stop = await this.herdr.openStream(
        id,
        event => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
        },
        error => {
          if (ws.readyState === WebSocket.OPEN) {
            const code =
              'code' in error && typeof error.code === 'string'
                ? error.code
                : undefined;
            ws.send(
              JSON.stringify({ type: 'error', code, message: error.message })
            );
            ws.close(1011, 'Herdr event stream ended');
          }
        }
      );
      if (ws.readyState !== WebSocket.OPEN) stop();
    } catch (error) {
      if (ws.readyState === WebSocket.OPEN) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to open agent stream';
        ws.send(JSON.stringify({ type: 'error', message }));
        ws.close(1011, 'Unable to open agent stream');
      }
    }
  }
}
