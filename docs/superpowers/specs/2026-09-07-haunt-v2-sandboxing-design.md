# Haunt v2 — Sub-project 1: Sandboxing

> Part of the [v2 harness program](2026-09-07-haunt-v2-harness-program-design.md).
> This is sub-project 1, built first because every later sub-project gives
> the model more autonomy, and containment has to exist before autonomy
> grows.

## Goal

Real, technical containment for a browser session acting on LLM
instructions — enforced by the environment, not by asking the model
nicely. Three concrete gaps closed:

1. Nothing currently stops a `goto <url>` action from leaving the target
   app's origin entirely.
2. A continuously-active session (not idle — sub-project 3's `--deep` mode
   will run long, busy sessions) has no wall-clock ceiling.
3. Credentials risk leaking into written reports (partially fixed already —
   see Non-goals).

## Design

### 1. Network origin allowlist — auto-detected, block clearly labeled

**Mechanism:** `context.route('**/*', handler)`, installed in
`hauntSpawn` (`tools/spawn.ts`) at browser-context creation, before
`page.goto(target_url)`. This covers every request the session makes for
its lifetime, across both the interactive MCP tools and headless mode,
since both paths go through the same `hauntSpawn`.

**Capture phase:** after the initial `page.goto()` reaches its `load`
event (not just `domcontentloaded` — fonts/CDN assets often load after
the DOM is parsed), the set of distinct origins seen in requests so far
becomes the session's allowlist. This is a one-time snapshot per session,
taken once, immediately after initial load.

**Enforcement:** any request after that point — navigation or subresource
— to an origin outside the allowlist is aborted at the network layer via
`route.abort()`, before it leaves the browser context. Requests to the
target origin itself are never restricted by path — `malicious-user`'s
existing playbook (probing `/admin`, `/api/users`, incrementing IDs) stays
fully intact; only cross-*origin* attempts are blocked.

**Labeling:** a blocked request is recorded to a new
`session.sandbox_blocked_requests: string[]` array — separate from
`session.network_errors` (genuine app-side failures the existing
`requestfailed` listener already tracks). This keeps the two signals
distinguishable everywhere downstream: a sandbox block must never be
misread as an app bug, the same failure mode this whole program exists to
avoid (recall the benchmark judge's tooling-artifact false positives).
`sandbox_blocked_requests` is surfaced in `EndSessionOutput` and, when
non-empty, in a distinct report section — informative (it shows what the
persona *tried*), never scored as a finding.

**Known limitation (explicit, not silent):** an app whose normal auth flow
redirects through a third-party identity provider on a *later* click (not
during initial load) will have that redirect blocked, since the identity
provider's origin wasn't seen in the capture window. Cross-origin
OAuth-style flows are out of scope for v1 sandboxing — noted here so a
future session hitting this doesn't mistake it for a bug.

### 2. Active-duration cap

`session.start_time` already exists (used today for `duration_seconds` in
`hauntEndSession`). A new check in `hauntNavigate`, alongside the existing
`step_count >= max_steps` guard, rejects further action once
`Date.now() - session.start_time` exceeds a cap:

```ts
export const SESSION_MAX_ACTIVE_DURATION_MS = 15 * 60 * 1_000; // 15 min default
```

This is a session-level field (`session.max_active_duration_ms`), not a
single hardcoded constant burned into `navigate.ts` — sub-project 3's
`--deep` mode will need to pass a larger budget explicitly. The default
above only applies when nothing overrides it, matching today's fixed-step
usage (3–30 steps, always well under 15 minutes in practice).

This is distinct from `SESSION_TTL_MS` (10 min *idle* reaping) — a
continuously-active session is never touched by that check today, which
is exactly the gap this closes.

### 3. Credential handling

Already shipped ahead of this spec (commit `b404453`): password values
are redacted from `Issue.description` when a password-field fill action
fails. Remaining scope here is narrower than the program doc originally
implied:

- Audit confirms `authenticate.ts` has no other place where `email` or
  `password` could reach a log line, Issue, or report field verbatim
  beyond the one already fixed.
- Cookies (from `haunt_get_cookies` / passed into `haunt_spawn`) are
  already scoped to the session and discarded on `haunt_end_session` —
  no persistence path exists today for them to leak into a report.
- Process-level exposure (e.g. `--password` visible in `ps` output on the
  host machine) is explicitly **out of scope** — that's an OS-level
  concern outside what this MCP server controls, not something a code
  change here can fix.

### 4. Testing strategy

- **The escape attempt must fail**: spawn a session against a local
  fixture, then issue a `goto <external-origin>` action; assert the
  action fails, `sandbox_blocked_requests` gains an entry, and no
  `network_errors` or `Issue` entry is created from it (proves the two
  signals stay separated).
- **Legitimate subresources aren't blocked**: a fixture page that loads a
  stylesheet/script from a second local origin during initial load; assert
  that origin ends up in the allowlist and a same-origin-as-that-CDN
  request later in the session still succeeds.
- **Active-duration cap fires**: a session whose `start_time` is
  backdated past the cap is refused on the next `haunt_navigate` call,
  with a clear error (mirrors the existing `max_steps` test pattern).
- **Redaction regression test**: already added (`navigate.test.ts`,
  commit `b404453`) — referenced here, not repeated.

## Non-goals for this sub-project

- OS-level isolation (container/VM per session) — `context.route()`
  network interception is the v1 boundary; process/OS sandboxing is a
  separate, much larger infrastructure investment not committed to here.
- Supporting cross-origin OAuth-style auth redirects (see Known
  limitation above).
- A size-based cap on the screenshots directory — time-based purging
  (`SCREENSHOT_MAX_AGE_MS`) already exists; a size cap is a reasonable
  future hardening but not required to close the three gaps this
  sub-project targets.

## Success criteria

(Restated from the program spec, made concrete here.) A `malicious-user`
session cannot cause a request to leave the target origin — proven by a
test that tries and is blocked, not by inspection. A session actively
driven past the active-duration cap is refused further action. No
credential value appears in any Issue, log, or report field under test.
