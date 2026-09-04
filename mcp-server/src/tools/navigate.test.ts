import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SessionManager } from '../session/manager.js';
import type { HauntSession } from '../types.js';
import { hauntNavigate } from './navigate.js';

function mockSessionAtStepLimit(): HauntSession {
  return {
    id: 'session-id',
    step_count: 3,
    max_steps: 3,
    last_activity: Date.now(),
    issues: [],
    pages_visited: [],
    console_errors: [],
    network_errors: [],
  } as unknown as HauntSession;
}

describe('hauntNavigate', () => {
  it('refuses to act once step_count reaches max_steps', async () => {
    const manager = new SessionManager();
    const session = mockSessionAtStepLimit();
    manager.set(session.id, session);

    await expect(
      hauntNavigate(manager, { session_id: session.id, action: 'click Login' }),
    ).rejects.toThrow(/step limit/);

    // Guard fires before touching the page, so step_count is left unchanged
    expect(session.step_count).toBe(3);
  });
});

// executeAction() is the natural-language action parser that interprets whatever
// string the orchestrator LLM decides on ("click Sign up", "fill ... in ...") into
// real Playwright calls. It's the single most exposed piece of the system to the
// LLM's phrasing choices, and was previously untested — these run it against real
// fixture pages (not mocks) so the role-based locator chain and text fallback are
// exercised exactly as they run in production.
describe('executeAction (via hauntNavigate)', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  let manager: SessionManager;

  afterEach(async () => {
    for (const session of manager?.all() ?? []) {
      await session.page.context().close();
    }
  });

  async function navigateOn(
    html: string,
    action: string,
    before?: (page: Page) => Promise<void>,
  ) {
    manager = new SessionManager();
    const page = await browser.newPage();
    // executeAction's fill() call has no explicit timeout, so it'd otherwise fall
    // back to Playwright's 30s default — keep the suite fast without touching
    // production behavior (which is untouched; this only applies to test pages).
    page.setDefaultTimeout(3_000);
    await page.setContent(html);
    await before?.(page);

    const session = {
      id: 'session-id',
      step_count: 0,
      max_steps: 10,
      last_activity: Date.now(),
      issues: [],
      pages_visited: [],
      console_errors: [],
      network_errors: [],
      page,
    } as unknown as HauntSession;
    manager.set(session.id, session);

    const result = await hauntNavigate(manager, {
      session_id: session.id,
      action,
    });
    return { result, page };
  }

  it('resolves "click <button>" over a link with the same text', async () => {
    const { result, page } = await navigateOn(
      `<button onclick="document.body.dataset.clicked='button'">Confirm</button>
       <a href="#" onclick="document.body.dataset.clicked='link'">Confirm</a>`,
      'click Confirm',
    );

    expect(result.success).toBe(true);
    expect(await page.evaluate(() => document.body.dataset.clicked)).toBe(
      'button',
    );
  });

  it('fills a field found by its label', async () => {
    const { result, page } = await navigateOn(
      `<label for="email">Email</label><input id="email" type="text" />`,
      'fill test@example.com in Email',
    );

    expect(result.success).toBe(true);
    expect(await page.inputValue('#email')).toBe('test@example.com');
  });

  it('fills a field found by its placeholder when there is no label', async () => {
    const { result, page } = await navigateOn(
      `<input type="text" placeholder="Search" />`,
      'fill shoes in Search',
    );

    expect(result.success).toBe(true);
    expect(await page.inputValue('input')).toBe('shoes');
  });

  it('falls back to text-content click when no role matches', async () => {
    // Nothing matches button/link/menuitem/tab/option, so executeAction burns
    // through all 5 role-locator attempts (3s timeout each) before reaching the
    // text-content fallback — hence the generous test timeout below.
    const { result, page } = await navigateOn(
      `<span onclick="document.body.dataset.clicked='span'">Dismiss</span>`,
      'click Dismiss',
    );

    expect(result.success).toBe(true);
    expect(await page.evaluate(() => document.body.dataset.clicked)).toBe(
      'span',
    );
  }, 20_000);

  it('reports a failed issue instead of throwing when a field has no accessible name', async () => {
    // No <label>, no placeholder, no aria-label — nothing for getByLabel /
    // getByPlaceholder / getByRole('textbox', { name }) to match on.
    const { result } = await navigateOn(
      `<input type="text" data-testid="mystery-field" />`,
      'fill hello in Mystery Field',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }, 5_000);

  it('executes goto and press actions', async () => {
    const { result: gotoResult } = await navigateOn(
      '<p>start</p>',
      `goto data:text/html,<p id="landed">landed</p>`,
    );
    expect(gotoResult.success).toBe(true);
    expect(gotoResult.page_url.startsWith('data:text/html')).toBe(true);

    const { result: pressResult, page } = await navigateOn(
      '<input type="text" />',
      'press A',
      (p) => p.locator('input').focus(),
    );
    expect(pressResult.success).toBe(true);
    expect(await page.inputValue('input')).toBe('A');
  });
});
