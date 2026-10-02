import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { hauntCaptureState } from './capture.js';
import { SCREENSHOTS_DIR } from './constants.js';
import { SessionManager } from './session/manager.js';
import { hauntSpawn } from './spawn.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  './persona/__fixtures__/valid-persona.yaml',
);

// What hauntCaptureState adds around the snapshot. The snapshot itself is
// covered, exhaustively, by the part 1 gate (gates/part-1/g1-snapshot).
describe('hauntCaptureState', () => {
  let manager: SessionManager;

  async function sessionOn(html: string) {
    manager = new SessionManager();
    const { session_id } = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: `data:text/html,${encodeURIComponent(html)}`,
    });
    return session_id;
  }

  afterEach(async () => {
    for (const session of manager?.all() ?? []) await session.browser.close();
  });

  it('returns the text snapshot by default, with references', async () => {
    const session_id = await sessionOn(
      '<title>Pricing</title><button>Create account</button><p>Start writing for free</p>',
    );

    const result = await hauntCaptureState(manager, { session_id });

    expect(result.title).toBe('Pricing');
    expect(result.text).toMatch(/- button "Create account" \[e\d+\]/);
    expect(result.text).toContain('Start writing for free');
    expect(result.elements).toBeUndefined();
    expect(result.screenshot_path).toBeUndefined();
  });

  it('returns the same snapshot as data when asked for json', async () => {
    const session_id = await sessionOn('<a href="/pricing">Pricing</a>');

    const result = await hauntCaptureState(manager, {
      session_id,
      format: 'json',
    });

    expect(result.elements).toEqual([
      expect.objectContaining({ role: 'link', name: 'Pricing', tag: 'a' }),
    ]);
  });

  it('saves a screenshot only when asked to', async () => {
    const session_id = await sessionOn('<p>hi</p>');

    const result = await hauntCaptureState(manager, {
      session_id,
      include_screenshot: true,
    });

    expect(result.screenshot_path).toMatch(
      new RegExp(`^${session_id}-capture-\\d+\\.png$`),
    );
    expect(existsSync(`${SCREENSHOTS_DIR}/${result.screenshot_path}`)).toBe(
      true,
    );
    rmSync(`${SCREENSHOTS_DIR}/${result.screenshot_path}`, { force: true });
  });

  it('counts as activity and does not consume a step', async () => {
    const session_id = await sessionOn('<p>hi</p>');
    const session = manager.get(session_id);
    session.last_activity = 0;

    await hauntCaptureState(manager, { session_id });

    expect(session.last_activity).toBeGreaterThan(0);
    expect(session.step_count).toBe(0);
  });

  it('throws for an unknown session', async () => {
    await expect(
      hauntCaptureState(new SessionManager(), { session_id: 'nope' }),
    ).rejects.toThrow('Session not found: nope');
  });
});
