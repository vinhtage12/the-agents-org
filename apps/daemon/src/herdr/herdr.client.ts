import { randomUUID } from 'node:crypto';
import { type Socket, createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../configuration/env.validation';

interface HerdrResponse<T = unknown> {
  id?: string;
  result?: T;
  error?: { code?: string; message?: string };
  [key: string]: unknown;
}

export class HerdrApiError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'HerdrApiError';
  }
}

export type HerdrEventHandler = (event: Record<string, unknown>) => void;

@Injectable()
export class HerdrClient {
  private readonly socketPath: string;

  constructor(config: ConfigService<Env, true>) {
    const configuredPath = config.get('HERDR_SOCKET_PATH', { infer: true });
    if (configuredPath) {
      this.socketPath = configuredPath;
    } else if (process.platform === 'win32') {
      throw new Error(
        'HERDR_SOCKET_PATH must be set to Herdr’s named pipe on Windows'
      );
    } else {
      this.socketPath = join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
        'herdr',
        'herdr.sock'
      );
    }
  }

  request<T>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 5000
  ): Promise<T> {
    const id = randomUUID();

    return new Promise<T>((resolve, reject) => {
      let buffer = '';
      let settled = false;
      const socket = createConnection(this.socketPath);
      const timer = setTimeout(() => {
        finishError(new Error(`Herdr request timed out: ${method}`));
        socket.destroy();
      }, timeoutMs);

      const finishError = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(
          error instanceof HerdrApiError
            ? error
            : new ServiceUnavailableException(
                `Unable to communicate with Herdr: ${error.message}`
              )
        );
      };

      socket.setEncoding('utf8');
      socket.once('connect', () => {
        socket.write(`${JSON.stringify({ id, method, params })}\n`);
      });
      socket.on('data', chunk => {
        buffer += chunk;
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
          if (!line) continue;

          let response: HerdrResponse<T>;
          try {
            response = JSON.parse(line) as HerdrResponse<T>;
          } catch {
            finishError(new Error('Herdr returned invalid JSON'));
            socket.destroy();
            return;
          }
          if (response.id !== id) continue;
          if (response.error) {
            finishError(
              new HerdrApiError(
                response.error.message ?? 'Herdr request failed',
                response.error.code ?? 'herdr_error'
              )
            );
            socket.destroy();
          } else if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(response.result as T);
            socket.end();
          }
        }
      });
      socket.once('error', finishError);
      socket.once('close', () => {
        if (!settled)
          finishError(new Error('Herdr socket closed without a response'));
      });
    });
  }

  subscribe(
    paneIds: string[],
    onEvent: HerdrEventHandler,
    onError: (error: Error) => void
  ): () => void {
    const id = randomUUID();
    let buffer = '';
    let subscribed = false;
    let closed = false;
    const socket: Socket = createConnection(this.socketPath);

    socket.setEncoding('utf8');
    socket.once('connect', () => {
      socket.write(
        `${JSON.stringify({
          id,
          method: 'events.subscribe',
          params: {
            subscriptions: paneIds.map(pane_id => ({
              type: 'pane.agent_status_changed',
              pane_id
            }))
          }
        })}\n`
      );
    });
    socket.on('data', chunk => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        try {
          const message = JSON.parse(line) as HerdrResponse;
          if (
            message.id === id &&
            ('result' in message || 'error' in message)
          ) {
            if (message.error) {
              onError(
                new HerdrApiError(
                  message.error.message ?? 'Herdr subscription failed',
                  message.error.code ?? 'herdr_error'
                )
              );
              socket.destroy();
              return;
            }
            subscribed = true;
            onEvent({ type: 'subscription_started' });
            continue;
          }
          if (subscribed) onEvent(message);
        } catch {
          onError(new Error('Herdr sent invalid event JSON'));
          socket.destroy();
          return;
        }
      }
    });
    socket.once('error', error => {
      if (!closed) onError(error);
    });
    socket.once('close', () => {
      if (!closed) onError(new Error('Herdr event subscription closed'));
    });

    return () => {
      closed = true;
      socket.end();
    };
  }
}
