// The action grammar, phrasing by phrasing. navigate.test.ts covers the locator
// chain and its failure modes; this file pins down which strings an LLM can
// send and what each one does, since that grammar is the tool's whole contract.
import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { hauntNavigate } from './navigate.js';
import { SessionManager } from './session/manager.js';
import type { HauntSession } from './types.js';

const FORM = `
  <label>Email <input id="email" /></label>
  <label>Password <input id="password" type="password" /></label>
  <input id="search" placeholder="Search products" />
  <button onclick="document.title = 'clicked ' + (window.n = (window.n || 0) + 1)">Save</button>
  <a href="#about" onclick="document.title = 'about'">About us</a>
  <div role="tab" onclick="document.title = 'tab'">Billing</div>
  <script>
    document.addEventListener('keydown', (e) => { document.title = 'key ' + e.key; });
  </script>
`;

describe('action grammar', () => {
  let browser: Browser;
  let page: Page;
  let manager: SessionManager;
  let session: HauntSession;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  afterEach(async () => {
    await page?.context().close();
  });

  async function act(action: string, issues?: HauntSession['issues']) {
    if (!session || page.isClosed()) await open(FORM);
    return hauntNavigate(manager, { session_id: session.id, action, issues });
  }

  async function open(html: string, maxSteps = 10) {
    manager = new SessionManager();
    page = await browser.newPage();
    page.setDefaultTimeout(3_000);
    await page.setContent(html);
    session = {
      id: 'session-id',
      step_count: 0,
      max_steps: maxSteps,
      start_time: Date.now(),
      max_active_duration_ms: Number.MAX_SAFE_INTEGER,
      last_activity: Date.now(),
      issues: [],
      pages_visited: [],
      console_errors: [],
      network_errors: [],
      sandbox_blocked_requests: [],
      page,
    } as unknown as HauntSession;
    manager.set(session.id, session);
  }

  describe('fill', () => {
    it.each([
      ['fill a@b.co in Email'],
      ['type a@b.co in Email'],
      ['enter a@b.co in Email'],
      ['input a@b.co in Email'],
      ['fill a@b.co into Email'],
      ['FILL a@b.co IN Email'],
      ['  fill a@b.co in Email  '],
      ['fill "a@b.co" in "Email"'],
      ["fill 'a@b.co' in 'Email'"],
    ])('%j fills the Email field', async (action) => {
      await open(FORM);
      const result = await act(action);
      expect(result.success, result.error).toBe(true);
      expect(await page.inputValue('#email')).toBe('a@b.co');
    });

    it('matches the field by partial, case-insensitive placeholder', async () => {
      await open(FORM);
      await act('fill shoes in search');
      expect(await page.inputValue('#search')).toBe('shoes');
    });

    it('keeps spaces inside the value', async () => {
      await open(FORM);
      await act('fill red running shoes in Search products');
      expect(await page.inputValue('#search')).toBe('red running shoes');
    });

    it('splits on the first " in ", so a value containing " in " is cut short', async () => {
      // Known limitation of the regex grammar: "sign in now" cannot be typed
      // as a value. Pinned so a change here is a deliberate one.
      await open(FORM);
      const result = await act('fill sign in now in Email');
      expect(result.success).toBe(false);
      expect(await page.inputValue('#email')).toBe('');
    });

    it('passes markup through verbatim, which is what malicious-user relies on', async () => {
      await open(FORM);
      const payload = '<script>alert(1)</script>';
      await act(`fill ${payload} in Email`);
      expect(await page.inputValue('#email')).toBe(payload);
      // Typed as text, never interpreted by the harness.
      expect(await page.title()).toBe('');
    });
  });

  describe('click', () => {
    it.each([
      ['click Save'],
      ['tap Save'],
      ['select Save'],
      ['Click Save'],
      // No verb at all falls through to a click on the whole string.
      ['Save'],
    ])('%j clicks the button', async (action) => {
      await open(FORM);
      const result = await act(action);
      expect(result.success, result.error).toBe(true);
      expect(await page.title()).toBe('clicked 1');
    });

    it('matches a partial, case-insensitive accessible name', async () => {
      await open(FORM);
      await act('click about');
      expect(await page.title()).toBe('about');
    });

    // Roles are tried in order (button, link, menuitem, tab, option), each
    // with a 3s timeout, so a tab costs three failed lookups before it matches.
    it('reaches non-button roles', async () => {
      await open(FORM);
      await act('click Billing');
      expect(await page.title()).toBe('tab');
    }, 20_000);

    it('clicks the first match when several elements share a name', async () => {
      await open(`
        <button onclick="document.title = 'first'">Delete</button>
        <button onclick="document.title = 'second'">Delete</button>
      `);
      await act('click Delete');
      expect(await page.title()).toBe('first');
    });
  });

  describe('press', () => {
    it.each([
      ['press Enter', 'key Enter'],
      ['hit Escape', 'key Escape'],
      ['key Tab', 'key Tab'],
      ['PRESS ArrowDown', 'key ArrowDown'],
    ])('%j sends the key', async (action, title) => {
      await open(FORM);
      const result = await act(action);
      expect(result.success, result.error).toBe(true);
      expect(await page.title()).toBe(title);
    });

    it('reports an unknown key name as a failed action', async () => {
      await open(FORM);
      const result = await act('press NotAKey');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown key/);
    });
  });

  describe('goto', () => {
    it.each([['goto'], ['go to'], ['navigate to'], ['GOTO']])(
      '"%s <url>" navigates',
      async (verb) => {
        await open(FORM);
        const url = 'data:text/html,<title>there</title>';
        const result = await act(`${verb} ${url}`);
        expect(result.success, result.error).toBe(true);
        expect(result.page_title).toBe('there');
        expect(result.page_url).toBe(url);
      },
    );

    it('reports an invalid URL as a failed action', async () => {
      await open(FORM);
      const result = await act('goto not a url');
      expect(result.success).toBe(false);
    });
  });

  describe('step accounting', () => {
    it('counts successful and failed actions alike', async () => {
      await open(FORM, 5);
      const ok = await act('click Save');
      const failed = await act('press NotAKey');
      expect([ok.step, ok.steps_remaining]).toEqual([1, 4]);
      expect([failed.step, failed.steps_remaining]).toEqual([2, 3]);
    });

    it('records the visited URL only for successful actions', async () => {
      await open(FORM);
      await act('click Save');
      await act('press NotAKey');
      expect(session.pages_visited).toHaveLength(1);
    });

    it('stores orchestrator-reported issues even when the action then fails', async () => {
      await open(FORM);
      const reported = {
        severity: 'minor' as const,
        category: 'content' as const,
        description: 'Typo in heading',
        page_url: '/',
        recommendation: 'Fix the typo',
      };
      await act('press NotAKey', [reported]);
      // The reported issue, plus the auto-filed "Action failed" one.
      expect(session.issues).toHaveLength(2);
      expect(session.issues[0]).toEqual(reported);
      expect(session.issues[1].description).toMatch(/^Action failed: /);
    });

    it('attaches a screenshot only to failed actions', async () => {
      await open(FORM);
      const ok = await act('click Save');
      const failed = await act('press NotAKey');
      expect(ok.screenshot_path).toBeUndefined();
      expect(failed.screenshot_path).toBe('session-id-step-2.png');
    });
  });

  describe('credential redaction', () => {
    it.each([
      ['fill hunter2 in Current password', 'hunter2'],
      ['type hunter2 into Confirm Password', 'hunter2'],
      ['enter me@x.io in Work email', 'me@x.io'],
    ])(
      '%j never leaks its value into the filed issue',
      async (action, secret) => {
        // No matching field on the page, so the fill fails and files an issue.
        await open('<p>no form here</p>');
        await act(action);
        expect(session.issues).toHaveLength(1);
        expect(session.issues[0].description).toContain('[REDACTED]');
        expect(session.issues[0].description).not.toContain(secret);
      },
    );

    it('leaves non-credential values readable in the filed issue', async () => {
      await open('<p>no form here</p>');
      await act('fill Paris in City');
      expect(session.issues[0].description).toContain('fill Paris in City');
    });
  });
});
