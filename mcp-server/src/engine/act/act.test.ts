// The corners of haunt_act that the part 1 gate does not reach: the less
// common parameters, and the mistakes a caller can make.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Action, ActionError } from '../../gates/part-1/contract.js';
import { hauntCaptureState } from '../capture.js';
import { SessionManager } from '../session/manager.js';
import { hauntSpawn } from '../spawn.js';
import { hauntAct } from './act.js';
import { validateAction } from './schema.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../persona/__fixtures__/valid-persona.yaml',
);

const PAGE = `<!doctype html><title>act</title>
  <label>Name <input id="name" value="Ada"></label>
  <label>When <input id="when" type="date"></label>
  <div id="note" contenteditable="true" role="textbox" aria-label="Note">Hello</div>
  <label><input id="yes" type="radio" name="answer" checked> Yes</label>
  <label><input id="no" type="radio" name="answer"> No</label>
  <button id="plain">Plain</button>
  <label>Avatar <input id="file" type="file"></label>
  <p id="out"></p>
  <script>
    document.addEventListener('keydown', (e) => { document.getElementById('out').textContent = 'key ' + e.key; });
  </script>`;

describe('hauntAct', () => {
  let manager: SessionManager;
  let session_id: string;
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'haunt-act-'));
  });
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });
  afterEach(async () => {
    for (const session of manager?.all() ?? []) await session.browser.close();
  });

  async function open(extra: Record<string, unknown> = {}) {
    manager = new SessionManager();
    ({ session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: `data:text/html,${encodeURIComponent(PAGE)}`,
      timeout: 50,
      ...extra,
    }));
  }

  // The reference of the element with this name.
  async function ref(name: string): Promise<string> {
    const { elements = [] } = await hauntCaptureState(manager, {
      session_id,
      format: 'json',
    });
    const found = elements.find((e) => e.name === name);
    if (!found) throw new Error(`no element named ${name}`);
    return found.ref;
  }

  const act = (...actions: Action[]) =>
    hauntAct(manager, { session_id, actions });
  async function errorOf(action: Action): Promise<ActionError> {
    const result = await act(action);
    expect(result.results[0].ok).toBe(false);
    return result.results[0].error as ActionError;
  }
  const page = () => manager.get(session_id).page;

  it('appends to a field and to a contenteditable with clear: false', async () => {
    await open();
    await act(
      { type: 'fill', ref: await ref('Name'), text: ' Lovelace', clear: false },
      { type: 'fill', ref: await ref('Note'), text: ' world', clear: false },
    );
    expect(await page().inputValue('#name')).toBe('Ada Lovelace');
    expect(await page().locator('#note').innerText()).toBe('Hello world');
  });

  it('rejects text that is not a valid value for the field type', async () => {
    await open();
    expect(
      await errorOf({
        type: 'fill',
        ref: await ref('When'),
        text: 'next tuesday',
      }),
    ).toMatchObject({
      code: 'invalid_action',
      parameter: 'text',
    });
  });

  it('names an unknown key', async () => {
    await open();
    expect(await errorOf({ type: 'press', keys: 'NotAKey' })).toMatchObject({
      code: 'invalid_action',
      parameter: 'keys',
    });
  });

  it('presses a key on the page when no element is given', async () => {
    await open();
    await act({ type: 'press', keys: 'Escape' });
    expect(await page().locator('#out').textContent()).toBe('key Escape');
  });

  it('refuses select, options and check on elements that do not have them', async () => {
    await open();
    const button = await ref('Plain');
    expect(
      (await errorOf({ type: 'select', ref: button, values: ['x'] })).code,
    ).toBe('not_editable');
    expect((await errorOf({ type: 'options', ref: button })).code).toBe(
      'not_editable',
    );
    expect(
      await errorOf({ type: 'check', ref: button, checked: true }),
    ).toMatchObject({
      code: 'not_editable',
      role: 'button',
    });
  });

  it('will not uncheck a radio button', async () => {
    await open();
    expect(
      await errorOf({ type: 'check', ref: await ref('Yes'), checked: false }),
    ).toMatchObject({
      code: 'invalid_action',
      parameter: 'checked',
    });
    expect(await page().isChecked('#yes')).toBe(true);
  });

  it('refuses to type into something that takes no text', async () => {
    await open();
    expect(
      (await errorOf({ type: 'type', ref: await ref('Plain'), text: 'x' }))
        .code,
    ).toBe('not_editable');
  });

  it('says so when the text to scroll to is not on the page', async () => {
    await open();
    expect(
      (await errorOf({ type: 'scroll_to', text: 'no such sentence' })).code,
    ).toBe('timeout');
  });

  it('checks that uploaded files exist', async () => {
    await open();
    const input = await ref('Avatar');
    expect(
      await errorOf({
        type: 'upload',
        ref: input,
        files: [join(tmp, 'missing.txt')],
      }),
    ).toMatchObject({
      code: 'invalid_action',
      parameter: 'files',
    });

    const file = join(tmp, 'me.txt');
    writeFileSync(file, 'me');
    expect(
      (await act({ type: 'upload', ref: input, files: [file] })).results[0].ok,
    ).toBe(true);
    expect(
      await page()
        .locator('#file')
        .evaluate((el: HTMLInputElement) => el.files?.[0]?.name),
    ).toBe('me.txt');
  });

  it('refuses a tab that does not exist, and closing the last one', async () => {
    await open();
    expect(
      await errorOf({ type: 'tab', op: 'switch', index: 3 }),
    ).toMatchObject({
      code: 'invalid_action',
      parameter: 'index',
    });
    expect((await errorOf({ type: 'tab', op: 'close', index: 0 })).code).toBe(
      'invalid_action',
    );
  });

  it('opens a blank tab, switches back, and closes the other', async () => {
    await open();
    const opened = await act({ type: 'tab', op: 'new' });
    expect(opened.results[0].changes.tabs_opened).toEqual([1]);
    await act({ type: 'tab', op: 'switch', index: 0 });
    expect(manager.get(session_id).page.url()).toContain('data:text/html');
    const closed = await act({ type: 'tab', op: 'close', index: 1 });
    expect(closed.results[0].changes.tabs_closed).toEqual([1]);
    expect(manager.get(session_id).runtime.tabs).toHaveLength(1);
  });

  it('times out waiting for a URL or an element that never comes', async () => {
    await open();
    expect(
      await errorOf({ type: 'wait_for', url: '/never', timeout_ms: 200 }),
    ).toMatchObject({
      code: 'timeout',
      observed: expect.stringContaining('the URL does not contain it'),
    });
    expect(
      (await errorOf({ type: 'wait_for', ref: 'e999999', timeout_ms: 200 }))
        .code,
    ).toBe('unknown_ref');
  });

  it('reads one element', async () => {
    await open();
    const result = await act({ type: 'read', ref: await ref('Note') });
    expect(result.results[0].text).toBe('Hello');
  });

  it('resizes the viewport', async () => {
    await open();
    await act({ type: 'resize', width: 400, height: 500 });
    expect(page().viewportSize()).toEqual({ width: 400, height: 500 });
  });

  it('records the issues that come with a call', async () => {
    await open();
    const issue = {
      severity: 'minor' as const,
      category: 'content' as const,
      description: 'Typo',
      page_url: '/',
      recommendation: 'Fix it',
    };
    await hauntAct(manager, {
      session_id,
      actions: [{ type: 'reload' }],
      issues: [issue],
    });
    expect(manager.get(session_id).issues).toEqual([issue]);
  });

  it('refuses to act past the duration cap', async () => {
    await open({ max_active_duration_ms: 1 });
    await new Promise((r) => setTimeout(r, 10));
    await expect(act({ type: 'reload' })).rejects.toThrow(
      /active-duration cap \(1ms\)/,
    );
  });

  it('labels something that is not an action as invalid, and says what an action looks like', async () => {
    await open();
    const result = await hauntAct(manager, { session_id, actions: ['submit'] });
    expect(result.results[0]).toMatchObject({
      type: 'invalid',
      ok: false,
      error: { code: 'invalid_action', parameter: 'type' },
    });
    expect(result.results[0].error?.message).toContain(
      'An action is an object',
    );
  });

  it('throws for an unknown session', async () => {
    await expect(
      hauntAct(new SessionManager(), {
        session_id: 'nope',
        actions: [{ type: 'reload' }],
      }),
    ).rejects.toThrow('Session not found: nope');
  });
});

describe('validateAction', () => {
  it.each([
    [{ type: 'scroll_to' }, 'ref'],
    [{ type: 'drag', from_ref: 'e1' }, 'to_ref'],
    [{ type: 'wait_for' }, 'text'],
    [{ type: 'tab', op: 'close' }, 'index'],
    [{ type: 'resize', width: 10, height: 600 }, 'width'],
    [{ type: 'upload', ref: 'e1', files: [] }, 'files'],
    [null, 'type'],
    ['click e1', 'type'],
  ])('%j is invalid because of %s', (action, parameter) => {
    expect(validateAction(action)).toMatchObject({ ok: false, parameter });
  });

  it.each([
    [{ type: 'tab', op: 'new' }],
    [{ type: 'wait_for', ms: 100 }],
    [{ type: 'drag', from_ref: 'e1', offset: { x: 5, y: 0 } }],
    [{ type: 'scroll_to', text: 'Pricing' }],
  ])('%j is valid', (action) => {
    expect(validateAction(action).ok).toBe(true);
  });
});
