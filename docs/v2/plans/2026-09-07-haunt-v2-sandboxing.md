# Haunt v2 Sandboxing Implementation Plan


**Goal:** Close three concrete gaps in haunt's browser-session containment: a `goto <url>` action can leave the target app's origin entirely with nothing stopping it; a continuously-active session has no wall-clock ceiling; and (already partially fixed) credential values could leak into written reports.

**Architecture:** A `context.route('**/*', ...)` handler installed at browser-context creation in `hauntSpawn` auto-captures every origin the target page loads during its own initial load, then blocks (and separately records) any request to an origin outside that set for the rest of the session. A parallel, independent check in `hauntNavigate` enforces a configurable active-duration ceiling using the session's existing `start_time`. Both mechanisms are pure additions to the existing tool functions — no new MCP tools, no change to the natural-language action interface.

**Tech Stack:** TypeScript, Playwright (`context.route()`, `route.abort()`/`route.continue()`), Vitest, `node:http` for local multi-origin test fixtures.

**Spec:** [docs/v2/specs/2026-09-07-haunt-v2-sandboxing-design.md](../specs/2026-09-07-haunt-v2-sandboxing-design.md) (sub-project 1 of [docs/v2/specs/2026-09-07-haunt-v2-harness-program-design.md](../specs/2026-09-07-haunt-v2-harness-program-design.md))

## Global Constraints

- The origin allowlist is captured **once**, after the initial `page.goto()` reaches the `load` event (not `domcontentloaded`) — a one-time snapshot, not a continuously-growing allowlist.
- A blocked request is recorded to `session.sandbox_blocked_requests: string[]`, kept **completely separate** from `session.network_errors` and never becomes an `Issue` — a sandbox block must never be misreported as an app bug.
- The active-duration cap is a **per-session field** (`session.max_active_duration_ms`), defaulting to the new `SESSION_MAX_ACTIVE_DURATION_MS` constant (15 min) — not a single hardcoded value burned into `navigate.ts`.
- Do **not** expose `max_active_duration_ms` on the `haunt_spawn` MCP tool's public `inputSchema` in `server.ts` — no current caller needs to override it; adding unused surface area now is out of scope. The `SpawnInput` TypeScript field is enough.
- Non-goals (do not implement): OS-level container/VM sandboxing, cross-origin OAuth-redirect support, a size-based cap on the screenshots directory.
- Every task must leave `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, and `npm run build` green in `mcp-server/` before its commit.

---

### Task 1: Network origin allowlist — capture, enforce, and keep separate from app errors

**Files:**
- Modify: `mcp-server/src/types.ts` (add field to `HauntSession`)
- Modify: `mcp-server/src/tools/spawn.ts`
- Modify: `mcp-server/src/tools/navigate.ts`
- Test: `mcp-server/src/tools/navigate.test.ts`

**Interfaces:**
- Produces: `HauntSession.sandbox_blocked_requests: string[]` — consumed by Task 3 (report threading) and by later sub-projects that read session state.

- [ ] **Step 1: Add the new session field**

In `mcp-server/src/types.ts`, add `sandbox_blocked_requests` to `HauntSession`:

```ts
export interface HauntSession {
  id: string;
  persona: PersonaConfig;
  browser: Browser;
  page: Page;
  issues: Issue[];
  pages_visited: string[];
  start_time: number;
  last_activity: number;
  step_count: number;
  max_steps: number;
  // Mutable arrays — errors are captured via Playwright events and spliced out per step
  console_errors: string[];
  network_errors: string[];
  // Requests the sandbox blocked because their origin was never seen during
  // the target page's own initial load. Kept separate from network_errors —
  // a sandbox block is not an app failure and must never be reported as one.
  sandbox_blocked_requests: string[];
}
```

- [ ] **Step 2: Write the failing test — blocks an origin never seen at startup**

In `mcp-server/src/tools/navigate.test.ts`, add these imports at the top (alongside the existing ones):

```ts
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { hauntSpawn } from './spawn.js';
```

And add this new `describe` block at the end of the file (after the existing `executeAction (via hauntNavigate)` block):

```ts
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
      res.setHeader('Content-Type', 'text/html');
      res.end(`<script src="${baseB}/lib.js"></script><p>origin A</p>`);
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
```

Note: `VALID_PERSONA` and `SessionManager` are already imported at the top
of this file by the existing tests — do not re-import them.

**Important — a pre-existing helper will break without this fix.** The
`navigateOn` helper (already in this file, used by every test in the
`executeAction (via hauntNavigate)` block) builds its own bare session
object that does not have `sandbox_blocked_requests`. Once Step 5 below
adds `session.sandbox_blocked_requests.length` to `hauntNavigate`, every
one of those existing tests would crash with "Cannot read properties of
undefined." Find the `navigateOn` helper's session object (currently
`{ id: 'session-id', step_count: 0, max_steps: 10, last_activity:
Date.now(), issues: [], pages_visited: [], console_errors: [],
network_errors: [], page }`) and add `sandbox_blocked_requests: []` to it:

```ts
    const session = {
      id: 'session-id',
      step_count: 0,
      max_steps: 10,
      last_activity: Date.now(),
      issues: [],
      pages_visited: [],
      console_errors: [],
      network_errors: [],
      sandbox_blocked_requests: [],
      page,
    } as unknown as HauntSession;
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd mcp-server && npx vitest run src/tools/navigate.test.ts -t "sandboxing"`
Expected: FAIL — `hauntSpawn` is not yet imported correctly against a
session whose `sandbox_blocked_requests` field doesn't exist yet, and
`session.sandbox_blocked_requests` is `undefined` (TypeScript will also
flag this once the type is used — the test run itself should fail with
either a type error surfaced by vitest's esbuild transform, or a runtime
`undefined.some is not a function`).

- [ ] **Step 4: Implement the route handler in `spawn.ts`**

In `mcp-server/src/tools/spawn.ts`, add the allowlist-capture logic between
`browser.newContext(...)` and `context.newPage()`, and freeze it after the
initial navigation's `load` event:

```ts
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
  const allowedOrigins = new Set<string>();
  const sandboxBlockedRequests: string[] = [];
  let capturingAllowlist = true;

  await context.route('**/*', async (route) => {
    const request = route.request();
    let origin: string;
    try {
      origin = new URL(request.url()).origin;
    } catch {
      sandboxBlockedRequests.push(
        `${request.method()} ${request.url()} (unparseable URL)`,
      );
      await route.abort();
      return;
    }

    if (capturingAllowlist) {
      allowedOrigins.add(origin);
      await route.continue();
      return;
    }

    if (allowedOrigins.has(origin)) {
      await route.continue();
      return;
    }

    sandboxBlockedRequests.push(`${request.method()} ${request.url()}`);
    await route.abort();
  });

  const page = await context.newPage();
```

Then, right after the existing `page.goto(...)` call succeeds, freeze the
allowlist:

```ts
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
```

Finally, add `sandbox_blocked_requests: sandboxBlockedRequests` to the
`session` object literal (same array reference, not a copy — mirrors how
`console_errors`/`network_errors` are already threaded through):

```ts
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
    console_errors: consoleErrors,
    network_errors: networkErrors,
    sandbox_blocked_requests: sandboxBlockedRequests,
  };
```

- [ ] **Step 5: Suppress the generic Issue when a failure was a sandbox block**

In `mcp-server/src/tools/navigate.ts`, inside `hauntNavigate`, capture the
blocked-count before the action runs, and use it to decide whether to
create an `Issue`:

```ts
  let screenshotPath: string | undefined;
  const blockedCountBefore = session.sandbox_blocked_requests.length;

  try {
    await executeAction(page, input.action);
  } catch (error) {
    const wasSandboxBlocked =
      session.sandbox_blocked_requests.length > blockedCountBefore;

    screenshotPath = `${session.id}-step-${session.step_count}.png`;
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshotPath}` });

    if (!wasSandboxBlocked) {
      const issue: Issue = {
        severity: 'major',
        category: 'ux',
        description: `Action failed: "${redactActionForReporting(input.action)}". ${error instanceof Error ? error.message : String(error)}`,
        page_url: page.url(),
        screenshot_path: screenshotPath,
        recommendation:
          'Ensure this interaction is reachable and clearly labeled.',
      };
      session.issues.push(issue);
    }

    return {
      success: false,
      page_url: page.url(),
      page_title: await page.title(),
      console_errors: stepConsoleErrors,
      network_errors: stepNetworkErrors,
      screenshot_path: screenshotPath,
      error: error instanceof Error ? error.message : String(error),
      step: session.step_count,
      steps_remaining: session.max_steps - session.step_count,
    };
  }
```

(Only the `let screenshotPath` declaration gains the new
`blockedCountBefore` line above it, and the `if (!wasSandboxBlocked)`
wrapping around the existing `issue`/`session.issues.push` — everything
else in the catch block is unchanged.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd mcp-server && npx vitest run src/tools/navigate.test.ts`
Expected: PASS — all tests in the file, including the two new sandboxing
tests. This file also runs the pre-existing `executeAction` tests against
`data:` URLs; confirm those still pass unmodified (they exercise the same
route handler via `data:` targets, which have no meaningful origin to
gate — `new URL('data:...').origin` is the string `"null"`, which ends up
in the allowlist during capture and matches itself on later data: requests,
so nothing about the existing behavior changes).

- [ ] **Step 7: Run the full test suite, lint, typecheck, build**

Run: `cd mcp-server && npx vitest run && npx biome check src && npx tsc --noEmit && npm run build`
Expected: all green. Pay particular attention to `spawn.test.ts` (which
spawns against `data:` URLs and one unreachable URL) and any other test
that calls `hauntSpawn` — the route handler now runs for every one of
them; confirm none regress.

- [ ] **Step 8: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/types.ts mcp-server/src/tools/spawn.ts mcp-server/src/tools/navigate.ts mcp-server/src/tools/navigate.test.ts mcp-server/dist
git commit -m "feat: sandbox sessions to their target app's own origin

context.route() auto-captures every origin the target page loads during
its own initial load, then blocks anything outside that set for the rest
of the session. Blocked requests are recorded separately from
network_errors and never become an Issue, so a sandbox block can never be
misread as an app bug.

Part of the v2 harness program's sandboxing sub-project
(docs/v2/specs/2026-09-07-haunt-v2-sandboxing-design.md)."
```

---

### Task 2: Active-duration cap

**Files:**
- Modify: `mcp-server/src/constants.ts`
- Modify: `mcp-server/src/types.ts`
- Modify: `mcp-server/src/tools/spawn.ts`
- Modify: `mcp-server/src/tools/navigate.ts`
- Test: `mcp-server/src/tools/navigate.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `SESSION_MAX_ACTIVE_DURATION_MS` (constant), `HauntSession.max_active_duration_ms: number`, `SpawnInput.max_active_duration_ms?: number` — the override field a future sub-project (not part of this plan) will pass.

- [ ] **Step 1: Write the failing test**

In `mcp-server/src/tools/navigate.test.ts`, add near the top of the file
(after the existing imports), a helper mirroring
`mockSessionAtStepLimit`, and a new test inside the existing top-level
`describe('hauntNavigate', ...)` block (the same one that already contains
`'refuses to act once step_count reaches max_steps'`):

```ts
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
```

Add the import: `import { SESSION_MAX_ACTIVE_DURATION_MS } from '../constants.js';`

```ts
  it('refuses to act once the active-duration cap is exceeded', async () => {
    const manager = new SessionManager();
    const session = mockSessionPastDurationCap();
    manager.set(session.id, session);

    await expect(
      hauntNavigate(manager, { session_id: session.id, action: 'click Login' }),
    ).rejects.toThrow(/active-duration cap/);

    expect(session.step_count).toBe(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mcp-server && npx vitest run src/tools/navigate.test.ts -t "active-duration cap is exceeded"`
Expected: FAIL — `SESSION_MAX_ACTIVE_DURATION_MS` doesn't exist yet, and
no such check exists in `hauntNavigate`.

- [ ] **Step 3: Add the constant**

In `mcp-server/src/constants.ts`, add:

```ts
// A session actively driven (not idle — see SESSION_TTL_MS above, which
// only catches idle sessions) past this total duration since spawn is
// refused further action. Distinct per-session override exists on
// HauntSession.max_active_duration_ms for callers that need a larger
// budget (e.g. a long, deliberately deep investigation).
export const SESSION_MAX_ACTIVE_DURATION_MS = 15 * 60 * 1_000;
```

- [ ] **Step 4: Add the session field and wire the default/override in `spawn.ts`**

In `mcp-server/src/types.ts`, add to `HauntSession` (after `max_steps`):

```ts
  max_steps: number;
  // Total wall-clock budget since spawn, regardless of activity — distinct
  // from the idle-based SESSION_TTL_MS reaping. Defaults to
  // SESSION_MAX_ACTIVE_DURATION_MS; overridable per session.
  max_active_duration_ms: number;
```

In `mcp-server/src/tools/spawn.ts`, add to `SpawnInput`:

```ts
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
```

Add the import: `import { SCREENSHOT_MAX_AGE_MS, SESSION_MAX_ACTIVE_DURATION_MS, SESSION_TTL_MS } from '../constants.js';`

And set the field on the session object:

```ts
    max_steps: input.timeout ?? personaConfig.scenarios[0]?.max_steps ?? 30,
    max_active_duration_ms:
      input.max_active_duration_ms ?? SESSION_MAX_ACTIVE_DURATION_MS,
```

**Also update the `navigateOn` helper again.** It has no `start_time` or
`max_active_duration_ms` either. Without a fix, `Date.now() -
session.start_time` evaluates to `NaN`, and `NaN > undefined` is `false`
— so the check below would happen to never trip, but only by accident of
`NaN` comparison semantics, not because it's actually correct. Add both
fields explicitly so the helper's session is genuinely well-formed:

```ts
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
```

- [ ] **Step 5: Add the check in `navigate.ts`**

In `mcp-server/src/tools/navigate.ts`, no new import is needed (the
session already carries its own resolved `max_active_duration_ms` —
`navigate.ts` never needs to import the constant itself). Add the check
right after the existing `step_count >= max_steps` guard:

```ts
  if (session.step_count >= session.max_steps) {
    throw new Error(
      `Session ${session.id} hit its step limit (${session.max_steps}). Call haunt_end_session instead of navigating further.`,
    );
  }

  if (Date.now() - session.start_time > session.max_active_duration_ms) {
    throw new Error(
      `Session ${session.id} exceeded its active-duration cap (${session.max_active_duration_ms}ms). Call haunt_end_session instead of navigating further.`,
    );
  }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd mcp-server && npx vitest run src/tools/navigate.test.ts`
Expected: PASS — all tests, including the new one.

- [ ] **Step 7: Run the full test suite, lint, typecheck, build**

Run: `cd mcp-server && npx vitest run && npx biome check src && npx tsc --noEmit && npm run build`
Expected: all green. `spawn.test.ts` asserts exact `max_steps` values with
`toEqual`-style checks in a couple of places — confirm none of those
assertions accidentally compare the whole session object (they don't
today, but double-check after adding a field to `HauntSession`).

- [ ] **Step 8: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/constants.ts mcp-server/src/types.ts mcp-server/src/tools/spawn.ts mcp-server/src/tools/navigate.ts mcp-server/src/tools/navigate.test.ts mcp-server/dist
git commit -m "feat: add a wall-clock active-duration cap for sessions

SESSION_TTL_MS only reaps *idle* sessions — a continuously-busy session
(as a future deep-investigation mode will be) was never caught by it.
HauntSession.max_active_duration_ms (default SESSION_MAX_ACTIVE_DURATION_MS,
15 min) closes that gap, enforced in hauntNavigate alongside the existing
max_steps check.

Part of the v2 harness program's sandboxing sub-project."
```

---

### Task 3: Surface sandbox_blocked_requests through end-session, the report, and headless mode

**Files:**
- Modify: `mcp-server/src/tools/end-session.ts`
- Modify: `mcp-server/src/tools/generate-report.ts`
- Modify: `mcp-server/src/cli/headless.ts`
- Test: `mcp-server/src/tools/end-session.test.ts`
- Test: `mcp-server/src/tools/generate-report.test.ts`

**Interfaces:**
- Consumes: `HauntSession.sandbox_blocked_requests: string[]` (Task 1).
- Produces: `EndSessionOutput.sandbox_blocked_requests: string[]`,
  `SessionResult.sandbox_blocked_requests?: string[]` — consumed by any
  future report/dashboard tooling, and by `hauntGenerateReport`'s new
  section.

- [ ] **Step 1: Write the failing test for `hauntEndSession`**

In `mcp-server/src/tools/end-session.test.ts`, find the existing
`mockSession` helper and add `sandbox_blocked_requests: []` to its
defaults (it currently builds a `HauntSession`-shaped object without this
field — add it alongside the other array defaults like `issues: []`).
Then add a new test:

```ts
  it('surfaces sandbox_blocked_requests in the output', async () => {
    const manager = new SessionManager();
    const session = mockSession({
      sandbox_blocked_requests: ['GET http://evil.example/ (blocked)'],
    });
    manager.set(session.id, session);

    const result = await hauntEndSession(manager, {
      session_id: session.id,
    });

    expect(result.sandbox_blocked_requests).toEqual([
      'GET http://evil.example/ (blocked)',
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mcp-server && npx vitest run src/tools/end-session.test.ts -t "sandbox_blocked_requests"`
Expected: FAIL — `EndSessionOutput` has no `sandbox_blocked_requests`
field yet.

- [ ] **Step 3: Add the field to `EndSessionOutput`**

In `mcp-server/src/tools/end-session.ts`:

```ts
export interface EndSessionOutput {
  session_id: string;
  persona: string;
  duration_seconds: number;
  pages_visited: number;
  step_count: number;
  issues_found: Issue[];
  sandbox_blocked_requests: string[];
  overall_impression: string;
}
```

And in the `output` object construction:

```ts
  const output: EndSessionOutput = {
    session_id: session.id,
    persona: session.persona.name,
    duration_seconds,
    pages_visited: session.pages_visited.length,
    step_count: session.step_count,
    issues_found: session.issues,
    sandbox_blocked_requests: session.sandbox_blocked_requests,
    overall_impression:
      input.overall_impression ??
      `Completed ${session.step_count} steps across ${session.pages_visited.length} pages.`,
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mcp-server && npx vitest run src/tools/end-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the report section**

In `mcp-server/src/tools/generate-report.test.ts`, add a new test:

```ts
  it('renders a Sandbox-Blocked Requests section when any session has blocked requests', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['malicious-user'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/admin',
          persona: 'Malicious User',
          overall_impression: 'Tried to pivot elsewhere.',
          issues: [],
          sandbox_blocked_requests: ['GET http://evil.example/exfil (blocked)'],
        },
      ],
    });

    expect(result.markdown).toContain('## Sandbox-Blocked Requests');
    expect(result.markdown).toContain('GET http://evil.example/exfil (blocked)');
  });

  it('omits the Sandbox-Blocked Requests section when nothing was blocked', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/',
          persona: 'Confused Beginner',
          overall_impression: 'All good.',
          issues: [],
        },
      ],
    });

    expect(result.markdown).not.toContain('## Sandbox-Blocked Requests');
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd mcp-server && npx vitest run src/tools/generate-report.test.ts -t "Sandbox-Blocked"`
Expected: FAIL — `SessionResult` has no `sandbox_blocked_requests` field
(TypeScript error on the test's own input) and no such section is
rendered.

- [ ] **Step 7: Add the field and render the section**

In `mcp-server/src/tools/generate-report.ts`, add to `SessionResult`:

```ts
export interface SessionResult {
  area: string;
  persona: string;
  overall_impression: string;
  issues: Issue[];
  sandbox_blocked_requests?: string[];
}
```

Add a small render helper near the other `render*` functions:

```ts
function renderSandboxBlockedSection(blocked: string[]): string {
  return blocked.map((entry) => `- ${entry}`).join('\n');
}
```

In `hauntGenerateReport`, compute the aggregate right next to where
`allIssues`/`sorted` are computed:

```ts
  const allIssues = input.sessions.flatMap((s) => s.issues);
  const allBlockedRequests = input.sessions.flatMap(
    (s) => s.sandbox_blocked_requests ?? [],
  );
```

And append the section conditionally, after the `## For Claude` section is
pushed (so it reads as informational context, not a fix-priority item):

```ts
  bodySections.push(
    '',
    '## For Claude',
    '',
    'The following issues were found by Haunt. Fix them in order of severity.',
    '',
    forClaudeSection,
    '',
    `After fixing, run \`/haunt:haunt-test ${input.target_url}\` again to verify.`,
  );

  if (allBlockedRequests.length > 0) {
    bodySections.push(
      '',
      '## Sandbox-Blocked Requests',
      '',
      'These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.',
      '',
      renderSandboxBlockedSection(allBlockedRequests),
    );
  }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd mcp-server && npx vitest run src/tools/generate-report.test.ts`
Expected: PASS — all tests in the file.

- [ ] **Step 9: Thread it through `runPersonaSession` in `cli/headless.ts`**

In `mcp-server/src/cli/headless.ts`, find the `runPersonaSession` function
(it builds a `SessionResult` from `endResult` around where `endResult` is
awaited). Add `sandbox_blocked_requests: endResult.sandbox_blocked_requests`
to the returned object, alongside the existing `issues:
endResult.issues_found`:

```ts
  const endResult = await hauntEndSession(manager, {
    session_id: spawnResult.session_id,
  });

  return {
    area: targetUrl,
    persona: spawnResult.persona_name,
    overall_impression: endResult.overall_impression,
    issues: endResult.issues_found,
    sandbox_blocked_requests: endResult.sandbox_blocked_requests,
  };
```

- [ ] **Step 10: Run the full test suite, lint, typecheck, build**

Run: `cd mcp-server && npx vitest run && npx biome check src && npx tsc --noEmit && npm run build`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/tools/end-session.ts mcp-server/src/tools/end-session.test.ts mcp-server/src/tools/generate-report.ts mcp-server/src/tools/generate-report.test.ts mcp-server/src/cli/headless.ts mcp-server/dist
git commit -m "feat: surface sandbox-blocked requests in reports

sandbox_blocked_requests flows from HauntSession through EndSessionOutput
and SessionResult into a distinct 'Sandbox-Blocked Requests' report
section, explicitly labeled as not-a-bug — visibility into what a persona
tried, never scored as a finding.

Part of the v2 harness program's sandboxing sub-project."
```

---

### Task 4: Credential-handling audit

**Files:** none modified unless the audit finds a real leak (in which case,
fix it the same way commit `b404453` fixed the password-in-Issue leak, and
add a regression test next to the existing one in `navigate.test.ts`).

This is verification work, not new code by default — run each check below
and record the result.

- [ ] **Step 1: Confirm the existing redaction still holds**

Run: `cd mcp-server && npx vitest run src/tools/navigate.test.ts -t "redacts a password value"`
Expected: PASS (this test already exists, from commit `b404453`).

- [ ] **Step 2: Grep for every place `email`/`password` values flow, and inspect each hit**

Run: `cd mcp-server && grep -rn "\.password\|\.email\b" src --include="*.ts" | grep -v ".test.ts"`

For each hit, confirm the value is either (a) used only to build a
Playwright action string consumed exclusively by `executeAction` (safe —
the raw browser interaction is expected to see it), or (b) never embedded
into an `Issue`, a `console.log`/`console.error` call, or a value returned
from a tool function. As of this plan, the expected hits are all within
`mcp-server/src/cli/authenticate.ts` (building the `fill ... in Email` /
`fill ... in Password` action strings) and the CLI flag parsing in
`mcp-server/src/cli/headless.ts` / `mcp-server/src/benchmark/run.ts`
(reading `--email`/`--password` into `options.email`/`options.password`,
never logged). If a hit exists anywhere outside these files, or if any of
these files logs the raw value, that is a leak — fix it following the
pattern in `redactActionForReporting` (`navigate.ts`), and add a
regression test.

- [ ] **Step 3: Confirm cookies never persist past session end**

Read `mcp-server/src/tools/end-session.ts` and confirm
`manager.delete(input.session_id)` runs unconditionally (it does, as of
this plan) — a deleted session's `page`/`context`/cookies are not
reachable through `SessionManager` afterward. No code change expected;
this step is a read-and-confirm.

- [ ] **Step 4: Record the audit result**

If Steps 1–3 found nothing beyond what's already fixed, no commit is
needed for this task — note in the SDD ledger (or PR description, if not
using SDD) that the audit ran clean: "Task 4 credential audit: no
additional leak paths found beyond commit b404453." If a leak was found
and fixed, commit it:

```bash
cd /Users/matt/dev/haunt
git add <changed files> mcp-server/dist
git commit -m "fix: <describe the specific leak found and fixed>

Found during the sandboxing sub-project's credential-handling audit
(docs/v2/specs/2026-09-07-haunt-v2-sandboxing-design.md)."
```
