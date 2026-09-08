// mcp-server/src/tools/spawn.ts
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import type { Cookie } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  SCREENSHOT_MAX_AGE_MS,
  SESSION_MAX_ACTIVE_DURATION_MS,
  SESSION_TTL_MS,
} from '../constants.js';
import { loadPersona } from '../persona/loader.js';
import { purgeOldScreenshots } from '../screenshots.js';
import type { SessionManager } from '../session/manager.js';
import type { HauntSession } from '../types.js';

export interface SpawnInput {
  persona: string;
  target_url: string;
  headless?: boolean;
  timeout?: number;
  cookies?: Cookie[];
  // Overrides SESSION_MAX_ACTIVE_DURATION_MS for this session. Not exposed
  // on the haunt_spawn MCP tool schema yet — no current caller needs it.
  max_active_duration_ms?: number;
}

export interface SpawnOutput {
  session_id: string;
  persona_name: string;
  persona_goal: string;
  persona_description: string;
}

export async function hauntSpawn(
  manager: SessionManager,
  input: SpawnInput,
): Promise<SpawnOutput> {
  await manager.reapStale(SESSION_TTL_MS);
  purgeOldScreenshots(SCREENSHOT_MAX_AGE_MS);

  const personaConfig = loadPersona(input.persona);
  const sessionId = uuidv4();

  // Fail with a clear, actionable message instead of Playwright's generic
  // "Executable doesn't exist at ..." — this is the first tool call a new user
  // makes, and a silently-failed install (start.cjs logs it but starts anyway)
  // would otherwise surface here as an unhelpful low-level error.
  const executablePath = chromium.executablePath();
  if (!existsSync(executablePath)) {
    throw new Error(
      `Chromium is not installed at ${executablePath}. Run: node node_modules/playwright-core/cli.js install chromium (or npx playwright install chromium), then try again.`,
    );
  }

  const browser = await chromium.launch({
    headless: input.headless ?? personaConfig.browser.headless,
  });

  const context = await browser.newContext({
    viewport: personaConfig.browser.viewport ?? { width: 1280, height: 720 },
    locale: personaConfig.browser.locale,
  });

  if (input.cookies && input.cookies.length > 0) {
    await context.addCookies(input.cookies);
  }

  // Sandboxing: the origin allowlist starts empty and is populated with
  // every origin the target page itself requests during its own initial
  // load. Once that load completes, the allowlist is frozen — any later
  // request (navigation or subresource) to an origin outside it is
  // blocked, not just detected after the fact.
  //
  // Redirects are resolved manually below rather than delegated to Playwright:
  // route.continue() hands the request to Playwright's network stack, which
  // follows 3xx responses opaquely WITHOUT re-invoking this handler for the
  // redirect target. An allowlisted origin that 302s to an unlisted one would
  // therefore reach that origin (query string and all) unblocked and
  // unrecorded — a working exfiltration channel. route.fetch({ maxRedirects: 0 })
  // stops at the 3xx so the Location target can be checked against the
  // allowlist before the browser is ever handed the response.
  //
  // Recorded URLs are reduced to origin + pathname on purpose: query strings
  // routinely carry PII (an OAuth redirect's login_hint=<email>, a session
  // token, a search term) and these entries land verbatim in the written
  // report, alongside the credential redaction navigate.ts already does.
  const allowedOrigins = new Set<string>();
  const sandboxBlockedRequests: string[] = [];
  let capturingAllowlist = true;

  await context.route('**/*', async (route) => {
    const request = route.request();
    let origin: string;
    let originAndPath: string;
    try {
      const parsed = new URL(request.url());
      origin = parsed.origin;
      originAndPath = `${parsed.origin}${parsed.pathname}`;
    } catch {
      sandboxBlockedRequests.push(
        `${request.method()} ${request.url()} (unparseable URL)`,
      );
      await route.abort();
      return;
    }

    if (capturingAllowlist) {
      allowedOrigins.add(origin);
    } else if (!allowedOrigins.has(origin)) {
      sandboxBlockedRequests.push(`${request.method()} ${originAndPath}`);
      await route.abort();
      return;
    }

    let response: Awaited<ReturnType<typeof route.fetch>>;
    try {
      response = await route.fetch({ maxRedirects: 0 });
    } catch {
      // A genuine transport failure (server down, DNS, connection reset).
      // Aborting fires Playwright's requestfailed event, which records it in
      // networkErrors exactly as an un-intercepted failure would have.
      await route.abort();
      return;
    }

    const status = response.status();
    if (status >= 300 && status < 400) {
      const location = response.headers().location;
      if (location) {
        let target: URL | undefined;
        try {
          target = new URL(location, request.url());
        } catch {
          target = undefined;
        }
        if (!target) {
          sandboxBlockedRequests.push(
            `${request.method()} ${originAndPath} -> ${location} (unparseable redirect target)`,
          );
          await route.abort();
          return;
        }
        if (capturingAllowlist) {
          allowedOrigins.add(target.origin);
        } else if (!allowedOrigins.has(target.origin)) {
          sandboxBlockedRequests.push(
            `${request.method()} ${originAndPath} -> ${target.origin}${target.pathname} (cross-origin redirect)`,
          );
          await route.abort();
          return;
        }
      }
    }

    await route.fulfill({ response });
  });

  const page = await context.newPage();

  // Capture console errors and network failures via Playwright events
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('requestfailed', (request) => {
    // route.abort() on a sandbox-blocked request also fires this event.
    // Those are already recorded in sandboxBlockedRequests by the route
    // handler above — recording them here too would leak a sandbox block
    // into network_errors, which must stay app-failures-only.
    let origin: string | undefined;
    try {
      origin = new URL(request.url()).origin;
    } catch {
      origin = undefined;
    }
    // An unparseable URL was already recorded as a sandbox block by the route
    // handler's own unparseable branch, so it is skipped here for the same
    // reason a blocked-origin request is.
    if (!origin || !allowedOrigins.has(origin)) {
      return;
    }

    networkErrors.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });

  try {
    await page.goto(input.target_url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
  } catch {
    await browser.close();
    throw new Error(
      `${input.target_url} is not reachable. Make sure your dev server is running.`,
    );
  }

  // Give subresources (fonts, CDN scripts, analytics) that load after
  // domcontentloaded a chance to be captured into the allowlist too, before
  // enforcement begins. Best-effort — some pages never fully settle into a
  // 'load' event, so this must not hang spawn indefinitely.
  await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
  capturingAllowlist = false;

  const session: HauntSession = {
    id: sessionId,
    persona: personaConfig,
    browser,
    page,
    issues: [],
    pages_visited: [input.target_url],
    start_time: Date.now(),
    last_activity: Date.now(),
    step_count: 0,
    max_steps: input.timeout ?? personaConfig.scenarios[0]?.max_steps ?? 30,
    max_active_duration_ms:
      input.max_active_duration_ms ?? SESSION_MAX_ACTIVE_DURATION_MS,
    console_errors: consoleErrors,
    network_errors: networkErrors,
    sandbox_blocked_requests: sandboxBlockedRequests,
  };

  manager.set(sessionId, session);

  return {
    session_id: sessionId,
    persona_name: personaConfig.name,
    persona_goal: personaConfig.scenarios[0]?.goal ?? 'Explore the application',
    persona_description: personaConfig.system_prompt,
  };
}
