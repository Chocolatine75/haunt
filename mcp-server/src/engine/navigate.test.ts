import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_MAX_ACTIVE_DURATION_MS } from './constants.js';
import { hauntNavigate } from './navigate.js';
import { SessionManager } from './session/manager.js';
import { hauntSpawn } from './spawn.js';
import type { HauntSession } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  './persona/__fixtures__/valid-persona.yaml',
);

function mockSessionAtStepLimit(): HauntSession {
  return {
    id: 'session-id',
    step_count: 3,
    max_steps: 3,
    start_time: Date.now(),
    max_active_duration_ms: Number.MAX_SAFE_INTEGER,
    last_activity: Date.now(),
    issues: [],
    pages_visited: [],
    console_errors: [],
    network_errors: [],
    sandbox_blocked_requests: [],
  } as unknown as HauntSession;
}

function mockSessionPastDurationCap(): HauntSession {
  return {
    id: 'session-id',
    step_count: 0,
    max_steps: 30,
    start_time: Date.now() - (SESSION_MAX_ACTIVE_DURATION_MS + 1_000),
    max_active_duration_ms: SESSION_MAX_ACTIVE_DURATION_MS,
    last_activity: Date.now(),
    issues: [],
    pages_visited: [],
    console_errors: [],
    network_errors: [],
    sandbox_blocked_requests: [],
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

  it('refuses to act once the active-duration cap is exceeded', async () => {
    const manager = new SessionManager();
    const session = mockSessionPastDurationCap();
    manager.set(session.id, session);

    await expect(
      hauntNavigate(manager, { session_id: session.id, action: 'click Login' }),
    ).rejects.toThrow(/active-duration cap/);

    expect(session.step_count).toBe(0);
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

  it('redacts a password value from the Issue description when the fill fails', async () => {
    const secret = 'hunter2-super-secret';
    const { result } = await navigateOn(
      `<input type="text" data-testid="mystery-field" />`,
      `fill ${secret} in Password`,
    );

    expect(result.success).toBe(false);
    const [session] = manager.all();
    const issue = session.issues.at(-1);
    expect(issue?.description).toContain('[REDACTED]');
    expect(issue?.description).not.toContain(secret);
  }, 5_000);

  it('redacts an email value from the Issue description when the fill fails', async () => {
    const secretEmail = 'ci-test-user@example.com';
    const { result } = await navigateOn(
      `<input type="text" data-testid="mystery-field" />`,
      `fill ${secretEmail} in Email`,
    );

    expect(result.success).toBe(false);
    const [session] = manager.all();
    const issue = session.issues.at(-1);
    expect(issue?.description).toContain('[REDACTED]');
    expect(issue?.description).not.toContain(secretEmail);
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

// Sandboxing: the origin allowlist is captured from what the target page
// itself loads at startup, then enforced for the rest of the session. Real
// local HTTP servers (not data: URLs) are used because origin comparison
// needs genuinely distinct origins, and because a same-context route()
// handler must be exercised against real navigation/subresource requests.
describe('sandboxing — origin allowlist', () => {
  let serverA: Server; // the target app
  let serverB: Server; // a legitimate second origin, loaded by A at startup
  let serverC: Server; // never referenced by A — the escape-attempt target
  let baseA: string;
  let baseB: string;
  let baseC: string;
  // Every request origin C actually receives. The redirect test asserts this
  // stays empty — proving the block is real and not just recorded.
  const cRequests: string[] = [];

  beforeAll(async () => {
    serverB = createServer((req, res) => {
      if (req.url === '/lib.js') {
        res.setHeader('Content-Type', 'application/javascript');
        res.end('/* from B */');
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.end('<p>origin B page</p>');
      }
    });
    serverC = createServer((req, res) => {
      cRequests.push(req.url ?? '');
      res.setHeader('Content-Type', 'text/html');
      res.end('<p>origin C</p>');
    });
    await Promise.all([
      new Promise<void>((r) => serverB.listen(0, '127.0.0.1', r)),
      new Promise<void>((r) => serverC.listen(0, '127.0.0.1', r)),
    ]);
    baseB = `http://127.0.0.1:${(serverB.address() as AddressInfo).port}`;
    baseC = `http://127.0.0.1:${(serverC.address() as AddressInfo).port}`;

    serverA = createServer((req, res) => {
      // An open redirect on the allowlisted origin — the shape of a real
      // exfiltration attempt: attacker-controlled Location, secret in the
      // query string, hop starts at an origin the sandbox trusts.
      if (req.url?.startsWith('/redirect')) {
        res.writeHead(302, { Location: `${baseC}/steal?data=secret` });
        res.end();
        return;
      }
      // Same-origin redirect — must still be followed, not blocked.
      if (req.url === '/self-redirect') {
        res.writeHead(302, { Location: '/echo-cookie' });
        res.end();
        return;
      }
      if (req.url === '/setcookie') {
        res.writeHead(302, {
          'Content-Type': 'text/html',
          'Set-Cookie': 'sess=abc123; Path=/',
          Location: '/echo-cookie',
        });
        res.end();
        return;
      }
      if (req.url === '/echo-cookie') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<p id="c">${req.headers.cookie ?? 'none'}</p>`);
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      // `defer` matters: a deferred script is only requested after
      // domcontentloaded, but the browser still waits for it before firing
      // `load`. That makes this fixture actually discriminate between
      // freezing the allowlist at domcontentloaded (wrong — B would already
      // be blocked) vs at load (correct) — a plain synchronous <script> tag
      // would pass either way, since it's fetched before domcontentloaded.
      res.end(`<script defer src="${baseB}/lib.js"></script><p>origin A</p>`);
    });
    await new Promise<void>((r) => serverA.listen(0, '127.0.0.1', r));
    baseA = `http://127.0.0.1:${(serverA.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await Promise.all(
      [serverA, serverB, serverC].map(
        (s) => new Promise<void>((r, j) => s.close((e) => (e ? j(e) : r()))),
      ),
    );
  });

  let sandboxManager: SessionManager;
  afterEach(async () => {
    for (const session of sandboxManager?.all() ?? []) {
      await session.browser.close();
    }
  });

  it('blocks a goto to an origin never seen during initial load', async () => {
    sandboxManager = new SessionManager();
    const spawnResult = await hauntSpawn(sandboxManager, {
      persona: VALID_PERSONA,
      target_url: baseA,
      headless: true,
      timeout: 5,
    });

    const result = await hauntNavigate(sandboxManager, {
      session_id: spawnResult.session_id,
      action: `goto ${baseC}`,
    });

    expect(result.success).toBe(false);
    const session = sandboxManager.get(spawnResult.session_id);
    expect(
      session.sandbox_blocked_requests.some((r) => r.includes(baseC)),
    ).toBe(true);
    // A blocked navigation must never be misreported as an app bug
    expect(session.issues).toHaveLength(0);
    // route.abort() also fires Playwright's requestfailed event — the
    // blocked request must not leak into network_errors too, since that
    // flows back to the orchestrator and later into reports.
    expect(session.network_errors.some((r) => r.includes(baseC))).toBe(false);
  });

  // Regression: route.continue() hands the request to Playwright's network
  // stack, which follows 3xx responses without re-invoking the route handler.
  // A 302 from an allowlisted origin to an unlisted one therefore succeeded
  // silently and was never recorded — a working exfiltration channel that
  // defeated the whole sandbox. Redirects are now resolved manually.
  it('blocks a cross-origin redirect from an allowlisted origin', async () => {
    cRequests.length = 0;
    sandboxManager = new SessionManager();
    const spawnResult = await hauntSpawn(sandboxManager, {
      persona: VALID_PERSONA,
      target_url: baseA,
      headless: true,
      timeout: 5,
    });

    const result = await hauntNavigate(sandboxManager, {
      session_id: spawnResult.session_id,
      action: `goto ${baseA}/redirect`,
    });

    expect(result.success).toBe(false);
    const session = sandboxManager.get(spawnResult.session_id);

    // The redirect target was recorded as blocked...
    const entry = session.sandbox_blocked_requests.find((r) =>
      r.includes(baseC),
    );
    expect(entry).toBeDefined();
    expect(entry).toContain('cross-origin redirect');
    // ...with the query string stripped (it would carry PII into the report)
    expect(entry).not.toContain('data=secret');
    // ...and origin C never actually received the request
    expect(cRequests).toHaveLength(0);

    // A blocked redirect must never be misreported as an app bug
    expect(session.issues).toHaveLength(0);
    expect(session.network_errors.some((r) => r.includes(baseC))).toBe(false);

    // ...and the caller (orchestrator / decider LLM) gets an explicit signal
    expect(result.sandbox_blocked?.some((r) => r.includes(baseC))).toBe(true);
    expect(result.error).toContain('haunt test sandbox');
  });

  // Resolving redirects manually means every request now goes through
  // route.fetch() + route.fulfill() instead of route.continue(). These guard
  // the two things that round-trip could silently break: the browser's cookie
  // jar (haunt's whole --email/--password auth path depends on it) and
  // ordinary same-origin redirects.
  it('follows a same-origin redirect and preserves Set-Cookie through the sandbox', async () => {
    sandboxManager = new SessionManager();
    const spawnResult = await hauntSpawn(sandboxManager, {
      persona: VALID_PERSONA,
      // /setcookie sets a cookie AND redirects — exercising both at once
      target_url: `${baseA}/setcookie`,
      headless: true,
      timeout: 5,
    });

    const session = sandboxManager.get(spawnResult.session_id);
    expect(session.page.url()).toContain('/echo-cookie');
    expect(
      (await session.page.context().cookies()).some((c) => c.name === 'sess'),
    ).toBe(true);

    const result = await hauntNavigate(sandboxManager, {
      session_id: spawnResult.session_id,
      action: `goto ${baseA}/self-redirect`,
    });

    expect(result.success).toBe(true);
    expect(result.page_url).toContain('/echo-cookie');
    // The cookie was actually sent back to the server on that request
    expect(await session.page.textContent('#c')).toContain('sess=abc123');
    expect(session.sandbox_blocked_requests).toHaveLength(0);
  });

  it('does not block a request to an origin the target loaded legitimately at startup', async () => {
    sandboxManager = new SessionManager();
    const spawnResult = await hauntSpawn(sandboxManager, {
      persona: VALID_PERSONA,
      target_url: baseA,
      headless: true,
      timeout: 5,
    });

    const result = await hauntNavigate(sandboxManager, {
      session_id: spawnResult.session_id,
      action: `goto ${baseB}/`,
    });

    expect(result.success).toBe(true);
    const session = sandboxManager.get(spawnResult.session_id);
    expect(session.sandbox_blocked_requests).toHaveLength(0);
  });
});
