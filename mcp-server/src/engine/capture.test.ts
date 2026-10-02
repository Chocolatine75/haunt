import { existsSync, rmSync } from 'node:fs';
import { type Browser, chromium } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { hauntCaptureState } from './capture.js';
import { SCREENSHOTS_DIR } from './constants.js';
import { SessionManager } from './session/manager.js';
import type { HauntSession } from './types.js';

describe('hauntCaptureState (real page)', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
    rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
  });

  async function managerWithSessionOn(html: string) {
    const page = await browser.newPage();
    await page.setContent(html);
    const session = {
      id: `capture-test-${Date.now()}-${Math.random()}`,
      page,
    } as unknown as HauntSession;
    const manager = new SessionManager();
    manager.set(session.id, session);
    return { manager, session };
  }

  it('returns a populated ARIA accessibility tree', async () => {
    const { manager, session } = await managerWithSessionOn(
      '<button>Create account</button><p>Start writing for free</p>',
    );

    const result = await hauntCaptureState(manager, {
      session_id: session.id,
      include_screenshot: false,
    });

    expect(result.accessibility_tree_error).toBeUndefined();
    expect(result.accessibility_tree).toContain('Create account');
  });

  it('includes dom_snapshot only when requested, capped at 5000 chars', async () => {
    const { manager, session } = await managerWithSessionOn(
      `<div>${'x'.repeat(10_000)}</div>`,
    );

    const withoutDom = await hauntCaptureState(manager, {
      session_id: session.id,
      include_screenshot: false,
    });
    expect(withoutDom.dom_snapshot).toBeUndefined();

    const withDom = await hauntCaptureState(manager, {
      session_id: session.id,
      include_screenshot: false,
      include_dom: true,
    });
    expect(withDom.dom_snapshot).toBeDefined();
    expect(withDom.dom_snapshot?.length).toBeLessThanOrEqual(5_000);
  });

  it('writes a screenshot file when include_screenshot is not disabled', async () => {
    const { manager, session } = await managerWithSessionOn('<p>hi</p>');

    const result = await hauntCaptureState(manager, { session_id: session.id });

    expect(result.screenshot_path).toBeDefined();
    expect(existsSync(`${SCREENSHOTS_DIR}/${result.screenshot_path}`)).toBe(
      true,
    );
  });
});

describe('hauntCaptureState (accessibility failure handling)', () => {
  // A minimal stub page: only what hauntCaptureState touches. Lets us force the
  // ariaSnapshot() branch to fail deterministically, which is hard to do reliably
  // against a real live Chromium page.
  function stubPage(ariaSnapshotError: Error) {
    return {
      url: () => 'http://example.com/',
      title: async () => 'Example',
      screenshot: async () => undefined,
      locator: () => ({
        ariaSnapshot: async () => {
          throw ariaSnapshotError;
        },
      }),
      content: async () => '<html></html>',
    };
  }

  afterEach(() => {
    rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
  });

  it('surfaces accessibility_tree_error instead of throwing, and still returns the rest', async () => {
    const session = {
      id: 'stub-session',
      page: stubPage(new Error('ariaSnapshot boom')),
    } as unknown as HauntSession;
    const manager = new SessionManager();
    manager.set(session.id, session);

    const result = await hauntCaptureState(manager, {
      session_id: session.id,
      include_screenshot: false,
    });

    expect(result.accessibility_tree).toBeUndefined();
    expect(result.accessibility_tree_error).toBe('ariaSnapshot boom');
    expect(result.url).toBe('http://example.com/');
    expect(result.title).toBe('Example');
  });
});
