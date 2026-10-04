// The accessibility audit on a long page (R-S15): color-contrast is checked
// on a sample of the text past a number of elements, and says so; a short
// page is checked whole, as before.
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SessionManager } from '../session/manager.js';
import { hauntSpawn } from '../spawn.js';

const VALID_PERSONA = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../persona/__fixtures__/valid-persona.yaml',
);

// Faint grey on white, about 1.7:1.
const faint = (count: number) => `<!doctype html><html lang="en">
  <title>faint</title>
  <style>.faint { color: #c8c8c8; background: #fff; }</style>
  <main><h1>Release notes</h1>${Array.from(
    { length: count },
    (_, i) => `<p class="faint">Faint line ${i + 1}</p>`,
  ).join('')}</main></html>`;

describe('the contrast check on a long page', () => {
  let server: Server;
  let base: string;
  let manager: SessionManager;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const count = Number(
        new URL(req.url ?? '/', 'http://x').searchParams.get('n'),
      );
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(faint(count));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });
  // A browser that has just audited a thousand lines took more than vitest's
  // 10 s default to close on a Windows runner.
  afterEach(async () => {
    for (const session of manager?.all() ?? []) await session.browser.close();
  }, 30_000);

  const contrastAt = async (count: number) => {
    manager = new SessionManager();
    const { signals } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: `${base}?n=${count}`,
    });
    const found = signals.filter(
      (s) => s.kind === 'a11y' && s.rule === 'color-contrast',
    );
    expect(found).toHaveLength(1);
    return found[0] as Extract<(typeof found)[number], { kind: 'a11y' }>;
  };

  it('checks a thousand faint lines on 200 of them, and says so', async () => {
    const signal = await contrastAt(1000);
    expect(signal.nodes).toBeGreaterThan(150);
    expect(signal.nodes).toBeLessThanOrEqual(200);
    expect(signal.message).toContain('among 200 checked of 1001');
  });

  it('checks a short page whole, and says nothing of a sample', async () => {
    const signal = await contrastAt(12);
    expect(signal.nodes).toBe(12);
    expect(signal.message).not.toContain('checked of');
  });
});
