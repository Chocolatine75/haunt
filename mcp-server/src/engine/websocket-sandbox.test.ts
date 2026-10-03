// WebSockets do not pass through request routing, so the sandbox handles
// them separately. Found on a live run: the app's own dev-server socket was
// being refused (by a browser check, not by haunt) and nothing recorded it.
import { createHash } from 'node:crypto';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SessionManager } from './session/manager.js';
import { hauntSpawn } from './spawn.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  './persona/__fixtures__/valid-persona.yaml',
);

// An HTTP server that also accepts WebSocket handshakes and greets with "hi".
function startServer(
  upgrades: string[],
): Promise<{ host: string; server: Server }> {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<title>ws</title><p>ws</p>');
  });
  server.on('upgrade', (req, socket) => {
    upgrades.push(req.url ?? '');
    const accept = createHash('sha1')
      .update(
        `${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
      )
      .digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.write(Buffer.from([0x81, 2, 0x68, 0x69]));
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () =>
      done({
        host: `127.0.0.1:${(server.address() as AddressInfo).port}`,
        server,
      }),
    ),
  );
}

describe('sandboxing — WebSockets', () => {
  const ownUpgrades: string[] = [];
  const otherUpgrades: string[] = [];
  let own: { host: string; server: Server };
  let other: { host: string; server: Server };
  let manager: SessionManager;

  beforeAll(async () => {
    [own, other] = await Promise.all([
      startServer(ownUpgrades),
      startServer(otherUpgrades),
    ]);
  });
  afterAll(() => {
    for (const { server } of [own, other]) {
      server.closeAllConnections();
      server.close();
    }
  });
  afterEach(async () => {
    for (const session of manager?.all() ?? []) await session.browser.close();
  });

  async function session() {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: `http://${own.host}/`,
    });
    return manager.get(session_id);
  }

  // What the page gets back from opening a socket.
  const connect = (page: import('playwright').Page, host: string) =>
    page.evaluate(
      (h) =>
        new Promise<string>((done) => {
          const socket = new WebSocket(`ws://${h}/live?token=secret`);
          socket.onmessage = (e) => done(`message ${e.data}`);
          socket.onclose = () => done('closed');
          socket.onerror = () => done('error');
          setTimeout(() => done('timeout'), 3_000);
        }),
      host,
    );

  it("lets the app talk to its own origin's socket", async () => {
    const s = await session();
    expect(await connect(s.page, own.host)).toBe('message hi');
    expect(ownUpgrades).toContain('/live?token=secret');
    expect(s.sandbox_blocked_requests).toEqual([]);
    expect(s.console_errors).toEqual([]);
  });

  it('closes a socket to another origin, records it without its query, and never connects', async () => {
    const s = await session();
    expect(await connect(s.page, other.host)).not.toBe('message hi');
    expect(otherUpgrades).toEqual([]);
    expect(s.sandbox_blocked_requests).toEqual([`WS ws://${other.host}/live`]);
    expect(s.network_errors).toEqual([]);
  });
});
