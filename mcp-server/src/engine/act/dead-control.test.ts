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
  <p id="status" role="status"></p>
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
});
