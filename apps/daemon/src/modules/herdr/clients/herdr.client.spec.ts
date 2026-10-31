import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HerdrClient } from './herdr.client';

describe('HerdrClient', () => {
  it('sends JSONL requests and resolves the matching response', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'herdr-client-'));
    const socketPath = join(directory, 'herdr.sock');
    const server = createServer(socket => {
      let buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', chunk => {
        buffer += chunk;
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        const request = JSON.parse(buffer.slice(0, newline));
        socket.write(
          `${JSON.stringify({ id: request.id, result: { type: 'pong' } })}\n`
        );
      });
    });
    await new Promise<void>(resolve => server.listen(socketPath, resolve));

    try {
      const client = new HerdrClient({
        get: () => socketPath
      } as never);
      await expect(client.request('ping')).resolves.toEqual({ type: 'pong' });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  });
});
