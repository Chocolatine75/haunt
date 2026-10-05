// A sign-in refused as it should be is not a defect (R-S14). A real run
// against demo/ listed the 401 that answers a wrong password among what was
// detected, next to real failures. It is still a signal, marked `expected`,
// when the request carried a password typed in the session and the page told
// the user; a 401 the page says nothing about, or one that has nothing to do
// with signing in, is not.
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Signal } from '../../gates/part-2/contract.js';
import { hauntAct } from '../act/act.js';
import { hauntCaptureState } from '../capture.js';
import { SessionManager } from '../session/manager.js';
import { type SpawnInput, hauntSpawn } from '../spawn.js';

const VALID_PERSONA = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../persona/__fixtures__/valid-persona.yaml',
);

// ?silent=1: the page says nothing when it is refused.
const PAGE = `<!doctype html><html lang="en"><title>sign in</title>
  <main>
  <h1>Sign in</h1>
  <form id="form">
    <label>Email <input id="email" type="email"></label>
    <label>Password <input id="password" type="password"></label>
    <button type="submit">Sign in</button>
  </form>
  <button id="reset" type="button">Reset password</button>
  <button id="orders" type="button">Load orders</button>
  <p id="status" role="status"></p>
  </main>
  <script>
    const silent = new URLSearchParams(location.search).has('silent');
    const status = document.getElementById('status');
    const value = (id) => document.getElementById(id).value;
    const send = async (path, body) => {
      const response = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body),
      });
      if (!silent) status.textContent = response.ok ? 'Done' : 'Invalid email or password';
    };
    document.getElementById('form').addEventListener('submit', (event) => {
      event.preventDefault();
      send('/api/login', { email: value('email'), password: value('password') });
    });
    document.getElementById('reset').addEventListener('click', () => {
      send('/api/reset', { email: value('email') });
    });
    document.getElementById('orders').addEventListener('click', () => {
      send('/api/orders');
    });
  </script></html>`;

describe('a refused sign-in', () => {
  let server: Server;
  let origin: string;
  let manager: SessionManager;
  let session_id: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url?.startsWith('/api/')) {
        req.resume();
        res.writeHead(req.url === '/api/reset' ? 403 : 401, {
          'Content-Type': 'application/json',
        });
        res.end('{}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });
  afterEach(async () => {
    for (const session of manager?.all() ?? []) await session.browser.close();
  });

  async function open(path = '/', input: Partial<SpawnInput> = {}) {
    manager = new SessionManager();
    ({ session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: `${origin}${path}`,
      timeout: 50,
      ...input,
    }));
  }

  async function ref(name: string): Promise<string> {
    const { elements = [] } = await hauntCaptureState(manager, {
      session_id,
      format: 'json',
    });
    const found = elements.find((e) => e.name === name);
    if (!found) throw new Error(`no element named ${name}`);
    return found.ref;
  }

  // The http_error signals the action brings.
  async function errorsAfter(action: Record<string, unknown>) {
    const result = await hauntAct(manager, { session_id, actions: [action] });
    expect(result.results[0].ok).toBe(true);
    return result.signals.filter(
      (s): s is Extract<Signal, { kind: 'http_error' }> =>
        s.kind === 'http_error',
    );
  }

  const fill = async (name: string, text: string) =>
    errorsAfter({ type: 'fill', ref: await ref(name), text });
  const click = async (name: string) =>
    errorsAfter({ type: 'click', ref: await ref(name) });

  it('is marked expected when the page says so, the second time too', async () => {
    await open();
    await fill('Email', 'ada@example.com');
    await fill('Password', 'wrong-password-1');

    const [first, ...rest] = await click('Sign in');
    expect(rest).toEqual([]);
    expect(first).toMatchObject({
      status: 401,
      request_url: `${origin}/api/login`,
      while_logged_out: true,
      feedback: true,
      expected: true,
    });

    // The message is already there: nothing appears, and it is no less told.
    await fill('Password', 'wrong-password-2');
    const [second] = await click('Sign in');
    expect(second).toMatchObject({
      status: 401,
      feedback: false,
      expected: true,
    });
    // What was typed is in neither.
    expect(JSON.stringify([first, second])).not.toContain('wrong-password');
  }, 30_000);

  it('is not when the page says nothing', async () => {
    await open('/?silent=1');
    await fill('Email', 'ada@example.com');
    await fill('Password', 'wrong-password-1');
    const [signal, ...rest] = await click('Sign in');
    expect(rest).toEqual([]);
    expect(signal).toMatchObject({ status: 401, feedback: false });
    expect('expected' in signal).toBe(false);
    // Nor the second time, with still nothing said.
    const [again] = await click('Sign in');
    expect('expected' in again).toBe(false);
  }, 30_000);

  it('leaves alone a refusal that carries no password', async () => {
    await open();
    await fill('Email', 'ada@example.com');
    await fill('Password', 'wrong-password-1');
    // Refused for the address alone, and a plain request: both told to the
    // user, neither a sign-in.
    const [reset] = await click('Reset password');
    expect(reset).toMatchObject({ status: 403, feedback: true });
    expect('expected' in reset).toBe(false);
    const [orders] = await click('Load orders');
    expect(orders).toMatchObject({ status: 401 });
    expect('expected' in orders).toBe(false);
  }, 30_000);

  it('leaves alone a refusal in a session that came signed in', async () => {
    await open('/', {
      cookies: [
        { name: 'session', value: 'signed-in-0001', url: 'http://127.0.0.1' },
      ],
    });
    await fill('Email', 'ada@example.com');
    await fill('Password', 'wrong-password-1');
    const [signal] = await click('Sign in');
    expect(signal).toMatchObject({ status: 401, feedback: true });
    expect('expected' in signal).toBe(false);
  }, 30_000);
});
