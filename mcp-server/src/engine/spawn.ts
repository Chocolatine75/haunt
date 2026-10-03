// mcp-server/src/engine/spawn.ts
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import type { BrowserContext, Request } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import type { Signal, SignalThresholds } from '../gates/part-2/contract.js';
import { BUNDLE_CAP_BYTES } from '../gates/part-3/contract.js';
import { attachRuntime } from './act/runtime.js';
import {
  SCREENSHOT_MAX_AGE_MS,
  SESSION_MAX_ACTIVE_DURATION_MS,
  SESSION_TTL_MS,
} from './constants.js';
import { newRecording } from './evidence/recording.js';
import { loadPersona } from './persona/loader.js';
import { sabotaged } from './sabotage.js';
import { purgeOldScreenshots } from './screenshots.js';
import type { SessionManager } from './session/manager.js';

// How long a session's replays may take by default (R-E11).
const REPLAY_BUDGET_MS = 120_000;
import { auditIfNew } from './signals/audit.js';
import { REPORT_BINDING, SignalCollector } from './signals/collector.js';
import { installHooks } from './snapshot/page-script.js';
import { newSnapshotState, takeSnapshot } from './snapshot/snapshot.js';
import type { HauntSession } from './types.js';

export interface SpawnInput {
  persona: string;
  target_url: string;
  headless?: boolean;
  timeout?: number;
  // What addCookies accepts: only name and value are required, which is what
  // a host passing cookies by hand can be expected to provide.
  cookies?: Parameters<BrowserContext['addCookies']>[0];
  // Overrides SESSION_MAX_ACTIVE_DURATION_MS for this session. Not exposed
  // on the haunt_spawn MCP tool schema yet — no current caller needs it.
  max_active_duration_ms?: number;
  // Above which a response is slow, a task long, a request hung (R-S4).
  signal_thresholds?: Partial<SignalThresholds>;
  // How long the session's replays may take (R-E11), and how large one of
  // its bundles may grow (R-E16).
  replay_budget_ms?: number;
  bundle_cap_bytes?: number;
  // Not on the tool: a replay audits nothing it was not asked about.
  audit?: boolean;
}

export interface SpawnOutput {
  session_id: string;
  persona_name: string;
  persona_goal: string;
  persona_description: string;
  // What went wrong while the page loaded (step 0).
  signals: Signal[];
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
    // Every response reaches the page through the sandbox's route handler,
    // which makes Chromium treat the document as coming from a public
    // address. Its local-network-access check then refuses the app's own
    // WebSocket on localhost. The sandbox below is what decides where the
    // session may connect, so that check is turned off.
    args: ['--disable-features=LocalNetworkAccessChecks'],
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
  // Requests refused below, for whoever hears of their failure later.
  const refused = new WeakSet<Request>();

  // WebSockets do not go through context.route, so they get the same rule
  // here: the app's own origins connect, anything else is closed and
  // recorded. (ws://host is the same origin as http://host for this purpose.)
  await context.routeWebSocket(/.*/, (ws) => {
    let origin: string;
    let originAndPath: string;
    try {
      const parsed = new URL(ws.url());
      const scheme = parsed.protocol === 'wss:' ? 'https:' : 'http:';
      origin = `${scheme}//${parsed.host}`;
      originAndPath = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      sandboxBlockedRequests.push(`WS ${ws.url()} (unparseable URL)`);
      ws.close({ code: 1008, reason: 'blocked by the haunt test sandbox' });
      return;
    }
    if (capturingAllowlist) {
      allowedOrigins.add(origin);
    } else if (!allowedOrigins.has(origin)) {
      sandboxBlockedRequests.push(`WS ${originAndPath}`);
      ws.close({ code: 1008, reason: 'blocked by the haunt test sandbox' });
      return;
    }
    ws.connectToServer();
  });

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
      refused.add(request);
      await route.abort();
      return;
    }

    // Sabotage only (engine/sabotage.ts): requests from any tab but the first
    // go through unchecked. A new tab's first request has no frame yet.
    let exempt = false;
    if (sabotaged('new_tab_unsandboxed')) {
      try {
        exempt = runtime.tabs.indexOf(request.frame().page()) > 0;
      } catch {
        exempt = true;
      }
    }
    if (capturingAllowlist) {
      allowedOrigins.add(origin);
    } else if (!allowedOrigins.has(origin) && !exempt) {
      sandboxBlockedRequests.push(`${request.method()} ${originAndPath}`);
      refused.add(request);
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
          refused.add(request);
          await route.abort();
          return;
        }
        if (capturingAllowlist) {
          allowedOrigins.add(target.origin);
        } else if (!allowedOrigins.has(target.origin)) {
          sandboxBlockedRequests.push(
            `${request.method()} ${originAndPath} -> ${target.origin}${target.pathname} (cross-origin redirect)`,
          );
          refused.add(request);
          await route.abort();
          return;
        }
      }
    }

    await route.fulfill({ response });
  });

  // Runs in every document before its own scripts: lets the snapshot reach
  // closed shadow roots and keep element references stable.
  await context.addInitScript(installHooks);

  const snapshotState = newSnapshotState();
  const runtime = attachRuntime(context, snapshotState);

  // Signals: the network's side from the context's events, the page's side
  // from the hooks above, through a binding every document can call.
  const collector = new SignalCollector({
    thresholds: input.signal_thresholds,
    authenticated: Boolean(input.cookies && input.cookies.length > 0),
    sandbox: {
      blocked: (request) => refused.has(request),
      allowed: (origin) => capturingAllowlist || allowedOrigins.has(origin),
      blockedCount: () => sandboxBlockedRequests.length,
    },
  });
  collector.attach(context);
  await context.exposeBinding(REPORT_BINDING, (source, report: unknown) => {
    collector.fromPage(source, report);
  });

  // Console errors and network failures, from every tab of the session.
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  context.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  context.on('requestfailed', (request) => {
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

  const page = await context.newPage();

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
    snapshot: snapshotState,
    runtime,
    collector,
    signals: collector.signals,
    recording: newRecording(
      input.target_url,
      page.viewportSize() ?? { width: 1280, height: 720 },
      { ...input },
    ),
    evidence: {
      audit: input.audit !== false,
      replay_budget_ms: input.replay_budget_ms ?? REPLAY_BUDGET_MS,
      bundle_cap_bytes: input.bundle_cap_bytes ?? BUNDLE_CAP_BYTES,
      cookies: input.cookies,
    },
  };

  manager.set(sessionId, session);

  // The first page's audit (R-S15) names its elements by reference, so the
  // page is read first; both are step 0, delivered here.
  await takeSnapshot(session, { format: 'json' }, true).catch(() => {});
  await auditIfNew(session, 0);

  return {
    session_id: sessionId,
    persona_name: personaConfig.name,
    persona_goal: personaConfig.scenarios[0]?.goal ?? 'Explore the application',
    persona_description: personaConfig.system_prompt,
    signals: collector.deliver(0),
  };
}
