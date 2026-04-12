# /haunt-test

Run a phantom user test session against a running web application.

## Usage

/haunt-test <url> [--personas <list>] [--headed] [--steps N]

## Arguments

- `url` — Target URL (required). Must be a running server, e.g. http://localhost:3000
- `--personas` — Comma-separated persona names (default: confused-beginner)
  Available: confused-beginner, malicious-user, screen-reader-user
- `--headed` — Show the browser window in real time (default: headless)
- `--steps` — Max navigation steps per area (default: 3)
- `--email` — Email to log in with before testing
- `--password` — Password to log in with (use with --email)
- `--debug-auth` — Print each auth step verbosely (use when auth fails silently)

## First run

If `haunt_spawn` is not available as a tool, print:

```
haunt is installing Chromium (first run, ~2 min).
Come back once done and run again.
```

Then stop. Do NOT debug.

## Behavior

### Phase 0 — Header

Print exactly:

```
haunt v0.1.0  —  phantom user testing
```

### Phase 0.5 — Auth (only if --email and --password are provided)

If credentials are present:

Print: `logging in as <email>...`

1. `haunt_spawn` at `target_url` with timeout: 5
   - If `--debug-auth`: print `  · browser opened`
2. `haunt_capture_state` (`include_dom: true`) — look for a login form or link
   - If `--debug-auth`: print `  · page loaded`
3. If not already on a login page, `haunt_navigate` to find and go to the login page (look for a "Login", "Sign in", or "Se connecter" link in the accessibility tree or DOM)
   - If `--debug-auth`: print `  · login form found at <url>`
4. `haunt_navigate` — fill `<email>` in the email field
   - If `--debug-auth`: print `  · email filled`
5. `haunt_navigate` — fill `<password>` in the password field
   - If `--debug-auth`: print `  · password filled`
6. `haunt_navigate` — click the submit/login button
   - If `--debug-auth`: print `  · submit clicked`
7. `haunt_capture_state` — verify auth succeeded: URL is no longer the login page, or a logged-in element (avatar, dashboard, username) is visible
   - If `--debug-auth`: print `  · checking session...`
8. `haunt_get_cookies` — extract the session cookies
   - If `--debug-auth`: print `  · cookies captured (<N>)`
9. `haunt_end_session`

Print: `authenticated  —  cookies captured`

Store the cookies. Pass them to every `haunt_spawn` call in Phase 2 via the `cookies` parameter.

If login fails (still on login page after submit, or error visible): print `login failed — check your credentials` and stop.

### Phase 1 — Recon (route discovery from real links)

Parse arguments:
- `target_url` — the URL argument
- `personas` — from `--personas` (default: `["confused-beginner"]`)
- `headless` — true unless `--headed`
- `steps` — from `--steps` (default: 3)

Print: `scouting...`

Spawn one browser session with the first persona and `timeout: 5`.
Call `haunt_capture_state` with `include_dom: true`.

**Read real links from the DOM snapshot** — look for `href` attributes in `<a>` tags that start with `/` or the target origin. Extract distinct path segments. Do NOT guess common routes like /login or /dashboard unless you actually see them in the DOM.

Also read the accessibility tree for nav elements and any button/link text that suggests routes.

Call `haunt_end_session`. Build a page plan of up to 4 areas from the **real links you found**. If fewer than 4 real routes exist, test those — do not pad with guesses.

Print the discovered routes, e.g.: `routes: /  /login  /pricing  /dashboard`

### Phase 2 — Parallel testing

Print: `testing N areas...`

Run all sessions yourself — do NOT spawn sub-agents or agents.

1. `haunt_spawn` for every area in a single message (all in parallel). If auth cookies were captured in Phase 0.5, pass them via the `cookies` parameter to every `haunt_spawn` call.
2. `haunt_capture_state` for all sessions (`include_screenshot: false`, `include_dom: false`) — all in parallel.
3. Reason as each persona with a **corner-case mindset — NOT the happy path**:
   - What non-obvious action would this user take that a developer would never think to test?
   - What happens if they submit empty forms, enter wrong data types, go back after submitting?
   - What if they navigate directly to a URL they shouldn't have access to?
   - What breaks when they don't follow the expected flow?
   Prioritize unexpected behavior over intended flows.
4. `haunt_navigate` for all sessions in a single message, with any `issues` spotted.
   Choose corner-case actions: submit empty forms, enter bad data, access protected URLs directly, trigger the same action twice.
5. Repeat capture → navigate up to `steps - 1` more times.
6. `haunt_end_session` for all sessions in a single message.

CRITICAL: every batch of the same tool MUST be a single message with parallel tool calls.

On `haunt_spawn` failure: print `skipped /area: <error>` and continue.

### Phase 3 — Report

Do NOT spawn any agent or sub-agent. Generate the report yourself and save it with the Write tool.

**Compute from all EndSessionOutput objects:**
- total, critical, major, minor issue counts
- top fix: the single highest-impact recommendation across all sessions
- date: today's date (YYYY-MM-DD)
- persona names used

**Write to `.haunt-reports/YYYY-MM-DD-<persona-names>.md`** using this exact format:

```markdown
---
haunt: true
target: <url>
date: <YYYY-MM-DD>
personas: [<persona1>]
areas_tested: <N>
issues:
  total: <N>
  critical: <N>
  major: <N>
  minor: <N>
top_fix: "<single highest-impact fix, one sentence>"
---

# Haunt Report — <url>
<YYYY-MM-DD> · <N> areas · <total> issues · <persona names>

## Issues

### 1. [CRITICAL] <description>
- **Page:** `<page_url>`
- **Fix:** <concrete recommendation>

### 2. [MAJOR] <description>
- **Page:** `<page_url>`
- **Fix:** <concrete recommendation>

## Session Impressions

**<area> — <persona>:** "<overall_impression>"

## Top Fix

<highest-impact single action>
```

Sort issues: critical first, then major, then minor. Number sequentially.

**Then print the summary:**

```
----------------------------------------
N areas tested · TOTAL issues

[!!!] N critical
 [!!] N major
  [!] N minor

> description of critical issue 1  [/page]
> description of critical issue 2  [/page]

fix first: one-sentence highest-impact recommendation

report: .haunt-reports/YYYY-MM-DD-persona.md
----------------------------------------
```

Omit severity lines where count is 0.
If no criticals, replace `>` lines with: `no critical issues`
If no issues, omit `fix first`.
