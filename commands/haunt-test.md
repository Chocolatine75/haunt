# /haunt-test

Run a phantom user test session against a running web application.

## Usage

/haunt-test <url> [--personas <list>] [--headed] [--steps N] [--verbose]

## Arguments

- `url` — Target URL (required). Must be a running server, e.g. http://localhost:3000
- `--personas` — Comma-separated persona names (default: confused-beginner)
  Available: confused-beginner, malicious-user, screen-reader-user
- `--headed` — Show the browser window in real time (default: headless)
- `--steps` — Max navigation steps per area (default: 3)
- `--routes` — Comma-separated paths to test directly (e.g. `/signup,/pricing`),
  skipping Phase 1's DOM-based route discovery. Use when you already know which
  areas matter, or when scouting misses/over-picks routes.
- `--compare` — Path to a previous report (its `.md` path) to diff this run
  against. The final report and summary annotate each issue as new vs. still
  present, and list issues from that run that no longer reproduce.
- `--email` — Email to log in with before testing
- `--password` — Password to log in with (use with --email)
- `--debug-auth` — Print each auth step verbosely (use when auth fails silently)
- `--yes` — Skip the cost estimate confirmation prompt (for scripted use)
- `--verbose` — Print intermediate reasoning and observations between tool calls (default: silent)

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

- If `--debug-auth`: print `  · auth flow started`

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

If login fails (still on login page after submit, or error visible):
- If `--debug-auth`: print `  · login failed — session not detected`
Print `login failed — check your credentials` and stop.

### Phase 1 — Recon (route discovery from real links)

Parse arguments:
- `target_url` — the URL argument
- `personas` — from `--personas` (default: `["confused-beginner"]`)
- `headless` — true unless `--headed`
- `steps` — from `--steps` (default: 3)
- `routes` — from `--routes`, comma-separated, or empty if not given

**If `--routes` was given, skip discovery entirely**: the page plan is exactly
those paths (each resolved against `target_url`'s origin), in the order given —
no cap at 4. Print `routes (manual): <path1>  <path2>  ...` and go straight to
Phase 1.5.

Otherwise, discover routes from the real page:

Print: `scouting...`

Spawn one browser session with the first persona and `timeout: 5`.
Call `haunt_capture_state` with `include_dom: true`.

**Read real links from the DOM snapshot** — look for `href` attributes in `<a>` tags that start with `/` or the target origin. Extract distinct path segments. Do NOT guess common routes like /login or /dashboard unless you actually see them in the DOM.

Also read the accessibility tree for nav elements and any button/link text that suggests routes.

Call `haunt_end_session`. Build a page plan of up to 4 areas from the **real links you found**. If fewer than 4 real routes exist, test those — do not pad with guesses.

Print the discovered routes, e.g.: `routes: /  /login  /pricing  /dashboard`

### Phase 1.5 — Cost estimate

Call `haunt_estimate_cost` with `route_count` (number of areas in the page plan, max 4)
and `steps_per_route` (value of `--steps`, default: 3).

Print exactly:

```
<summary_line from the tool output>
proceed? [y/N]
```

- If `--yes` flag is present: skip the prompt and continue directly to Phase 2.
- Otherwise: wait for user input.
  - If user types `y` or `yes`: continue to Phase 2.
  - Any other input (including Enter alone): print `aborted.` and stop.

### Phase 2 — Parallel testing

Print: `testing N areas...`

Run all sessions yourself — do NOT spawn sub-agents or agents.

**SILENCE RULE: unless `--verbose` is passed, print NOTHING between tool calls. No step labels, no "parallel" announcements, no reasoning summaries, no observations. Zero text output between the `testing N areas...` line and the final summary block. Think entirely silently.**

1. `haunt_spawn` for every area in a single message (all in parallel). If auth cookies were captured in Phase 0.5, pass them via the `cookies` parameter to every `haunt_spawn` call.
   Keep track of which area each returned `session_id` belongs to — Phase 3 needs it.
2. `haunt_capture_state` for all sessions (`include_screenshot: false`, `include_dom: false`) — all in parallel.
3. Reason as each persona with a **corner-case mindset — NOT the happy path** (silently unless `--verbose`):
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

Do NOT spawn any agent or sub-agent. Do NOT hand-write the report file yourself —
`haunt_generate_report` computes the counts, sorts issues, renders the markdown, picks
the file path, and writes it to `.haunt-reports/`. Your job in this phase is only to
assemble its input and print its output.

**Never let credentials reach the report.** Issue descriptions, recommendations, and
`overall_impression` strings are your own text — `haunt_generate_report` writes exactly
what you give it. Never put the value of `--password`, `--email`, or any cookie
(name or value) into any of those fields. If something you captured (DOM, accessibility
tree) happens to contain one, redact it (e.g. `[redacted]`) before including it.

For each session, gather:
- `area` — the route it tested (tracked in Phase 2, step 1)
- `persona` — the persona's display name
- `overall_impression` — from that session's `EndSessionOutput`
- `issues` — that session's `EndSessionOutput.issues_found`

Call `haunt_generate_report` with `target_url`, `personas` (the list used this run),
`sessions` (the array assembled above), and — if `--compare <path>` was given —
`compare_with: <path>`.

**Print exactly the `summary` field the tool returns.** Do not reconstruct it yourself.
If `compare_with` was passed and the tool returns a `comparison_error`, that means the
path couldn't be read (e.g. typo, or a report from before comparison support existed)
— this is not a failure of the run itself, just note it's not comparable.
