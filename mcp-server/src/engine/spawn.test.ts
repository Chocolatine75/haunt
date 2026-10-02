import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from './session/manager.js';
import { hauntSpawn } from './spawn.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  './persona/__fixtures__/valid-persona.yaml',
);

describe('hauntSpawn', () => {
  let manager: SessionManager;

  afterEach(async () => {
    for (const session of manager?.all() ?? []) {
      await session.browser.close();
    }
  });

  it('opens a browser, navigates to target_url, and registers the session', async () => {
    manager = new SessionManager();

    const result = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: 'data:text/html,<h1>hello</h1>',
      headless: true,
    });

    expect(result.session_id).toBeTruthy();
    expect(result.persona_name).toBe('Test Persona');
    expect(result.persona_goal).toBe('Explore the app');

    const session = manager.get(result.session_id);
    expect(session.pages_visited).toEqual(['data:text/html,<h1>hello</h1>']);
    // Fixture's scenario max_steps is 10; no input.timeout override given
    expect(session.max_steps).toBe(10);
  });

  it('input.timeout overrides the persona default max_steps', async () => {
    manager = new SessionManager();

    const result = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: 'data:text/html,<h1>hello</h1>',
      timeout: 3,
    });

    expect(manager.get(result.session_id).max_steps).toBe(3);
  });

  it('injects cookies into the browser context before navigating', async () => {
    manager = new SessionManager();

    const result = await hauntSpawn(manager, {
      persona: VALID_PERSONA,
      target_url: 'data:text/html,<h1>hello</h1>',
      cookies: [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
    });

    const session = manager.get(result.session_id);
    const cookies = await session.page.context().cookies();
    expect(cookies).toContainEqual(
      expect.objectContaining({ name: 'session', value: 'abc123' }),
    );
  });

  it('closes the browser and leaves no registered session when target_url is unreachable', async () => {
    manager = new SessionManager();

    await expect(
      hauntSpawn(manager, {
        persona: VALID_PERSONA,
        // Nothing listens here — Playwright's navigation will fail fast.
        target_url: 'http://127.0.0.1:1/',
      }),
    ).rejects.toThrow(/not reachable/);

    expect(manager.all()).toHaveLength(0);
  });

  it('fails with a clear message instead of launching when Chromium is not installed', async () => {
    manager = new SessionManager();
    const spy = vi
      .spyOn(chromium, 'executablePath')
      .mockReturnValue('/nonexistent/chromium-9999/chrome');

    try {
      await expect(
        hauntSpawn(manager, {
          persona: VALID_PERSONA,
          target_url: 'data:text/html,<h1>hello</h1>',
        }),
      ).rejects.toThrow(/Chromium is not installed at \/nonexistent/);
    } finally {
      spy.mockRestore();
    }

    expect(manager.all()).toHaveLength(0);
  });
});
