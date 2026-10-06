// What counts as a dead control (R-S2) beyond the gate's pages: a click the
// page answers with what it already showed is not dead, nor one that stops
// something running out of sight, nor a click that was never meant to do
// anything (a right-click).
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { hauntCaptureState } from '../capture.js';
import { SessionManager } from '../session/manager.js';
import { hauntSpawn } from '../spawn.js';
import { hauntAct } from './act.js';

const VALID_PERSONA = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../persona/__fixtures__/valid-persona.yaml',
);

const PAGE = `<!doctype html><html lang="en"><title>dead</title>
  <button id="open" type="button">Open</button>
  <button id="stop" type="button">Stop sync</button>
  <button id="nothing" type="button">Nothing</button>
  <button id="attach" type="button">Attach a file</button>
  <input id="picked" type="file" hidden>
  <p id="status" role="status"></p>
  <form id="login">
    <input id="email" type="email" aria-label="Email">
    <input id="password" type="password" aria-label="Password">
    <button type="submit">Sign in</button>
  </form>
  <script>
    const status = document.getElementById('status');
    document.getElementById('open').addEventListener('click', () => {
      status.textContent = 'Opened';
    });
    // Runs out of sight: stopping it is the button's whole effect.
    let syncs = 0;
    const sync = setInterval(() => { syncs++; }, 3000);
    document.getElementById('stop').addEventListener('click', () => {
      clearInterval(sync);
    });
    document.getElementById('attach').addEventListener('click', () => {
      document.getElementById('picked').click();
    });
    // A submission the page swallows: dead, once the browser lets it through.
    document.getElementById('login').addEventListener('submit', (e) => {
      e.preventDefault();
    });
  </script></html>`;

describe('dead controls', () => {
  let server: Server;
  let url: string;
  let manager: SessionManager;
  let session_id: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });
  afterEach(async () => {
    for (const session of manager?.all() ?? []) await session.browser.close();
  });

  async function ref(name: string): Promise<string> {
    const { elements = [] } = await hauntCaptureState(manager, {
      session_id,
      format: 'json',
    });
    const found = elements.find((e) => e.name === name);
    if (!found) throw new Error(`no element named ${name}`);
    return found.ref;
  }

  async function deadAfter(action: Record<string, unknown>): Promise<string[]> {
    const result = await hauntAct(manager, { session_id, actions: [action] });
    expect(result.results[0].ok).toBe(true);
    return result.signals
      .filter((s) => s.kind === 'dead_control')
      .map((s) => (s.kind === 'dead_control' ? s.name : ''));
  }

  it('tells a dead button from one that shows again what it showed, or stops something', async () => {
    manager = new SessionManager();
    ({ session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: url,
      timeout: 50,
    }));
    const open = await ref('Open');
    expect(await deadAfter({ type: 'click', ref: open })).toEqual([]);
    // The second time, the status already says so: the page still answered.
    expect(await deadAfter({ type: 'click', ref: open })).toEqual([]);
    expect(
      await deadAfter({ type: 'click', ref: await ref('Stop sync') }),
    ).toEqual([]);

    const nothing = await ref('Nothing');
    // A right-click or a modified click is often meant to do nothing.
    expect(
      await deadAfter({ type: 'click', ref: nothing, button: 'right' }),
    ).toEqual([]);
    expect(
      await deadAfter({ type: 'click', ref: nothing, modifiers: ['Shift'] }),
    ).toEqual([]);
    expect(await deadAfter({ type: 'click', ref: nothing })).toEqual([
      'Nothing',
    ]);
  }, 30_000);

  // Seen when the sweep first ran over the gauntlet's upload page: each of
  // its four buttons was reported as wired to nothing. The file picker is
  // the browser's, and nothing of it is in the page.
  it('does not call dead a button that opens the file picker', async () => {
    manager = new SessionManager();
    ({ session_id } = await hauntSpawn(manager, {
      target_url: url,
      timeout: 50,
    }));
    const attach = await ref('Attach a file');
    expect(await deadAfter({ type: 'click', ref: attach })).toEqual([]);
    expect(await deadAfter({ type: 'click', ref: attach })).toEqual([]);
  }, 30_000);

  // On a real run against demo/, the sign-in button was reported dead with
  // "not-an-email" in its email field: once the field shows the browser's
  // message, another refused click changes nothing in the DOM, and the
  // browser's bubble is all a user sees.
  it('does not call a submit button dead when the browser refuses the form', async () => {
    manager = new SessionManager();
    ({ session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: url,
      timeout: 50,
    }));
    const fill = async (name: string, text: string) => {
      const result = await hauntAct(manager, {
        session_id,
        actions: [{ type: 'fill', ref: await ref(name), text }],
      });
      expect(result.results[0].ok).toBe(true);
    };
    const signIn = await ref('Sign in');
    await fill('Password', 'hunter2-secret');
    await fill('Email', 'not-an-email');
    expect(await deadAfter({ type: 'click', ref: signIn })).toEqual([]);
    // The second click finds the field's message already showing: the DOM
    // does not change, but the browser shows its bubble again.
    expect(await deadAfter({ type: 'click', ref: signIn })).toEqual([]);
    // A valid address goes through, and the page does nothing with it.
    await fill('Email', 'ada@example.com');
    expect(await deadAfter({ type: 'click', ref: signIn })).toEqual([
      'Sign in',
    ]);
  }, 30_000);
});
