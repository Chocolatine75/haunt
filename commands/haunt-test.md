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
haunt v0.2.0  —  phantom user testing
```

### How to act on a page

Every page is read with `haunt_capture_state` and acted on with `haunt_act`.

`haunt_capture_state` returns a text snapshot: the page's text in reading
order, and every element you can act on as a line such as
`- button "Create account" [e12]`. The part in square brackets is the
element's **reference**. Lines may also say `disabled`, `covered by e14`,
`hidden(...)`, `value="..."`, or `-> /path` for a link's destination.

`haunt_act` takes a list of actions that name elements by reference:

```
{ "type": "click", "ref": "e12" }
{ "type": "fill", "ref": "e7", "text": "hello" }
{ "type": "type", "ref": "e7", "text": "hello" }      (key by key, for fields that react to keystrokes)
{ "type": "press", "keys": "Enter" }
{ "type": "select", "ref": "e9", "values": ["Large"] }
{ "type": "check", "ref": "e4", "checked": true }
{ "type": "hover", "ref": "e3" }
{ "type": "scroll", "direction": "down" }
{ "type": "goto", "url": "http://localhost:3000/pricing" }
{ "type": "back" }
{ "type": "dialog", "accept": true }
{ "type": "wait_for", "text": "Saved" }
```

Other actions exist (`drag`, `upload`, `tab`, `scroll_to`, `resize`, `read`,
`options`, `reload`, `forward`); the tool's schema describes them.

Rules:

- **Only use references from the most recent snapshot of that session.** A
  reference to an element that no longer exists fails as `stale_ref`.
- Several actions may go in one call when the later ones do not depend on
  what the earlier ones do to the page (the fields of one form, then its
  submit button). The sequence stops at the first failure, navigation,
  dialog or new tab.
- Each action's result says what it changed. Read it:
  - `text_changes` lists the text that appeared and went away (an error
    message, a confirmation, a total). Before concluding that an action gave
    no feedback, check `text_changes.added`: a message that appeared is
    feedback, even though `diff` (which only lists elements) is empty.
  - `changes.none: true` on a control that should do something (a button, a
    link) is a finding: the control is dead. The engine raises it as a
    `dead_control` signal when nothing at all happened; report it naming
    that signal.
  - `ok: false` is information about the page, with a `code`: `covered` (and
    by what), `disabled`, `not_visible`, `stale_ref`… It is a finding only
    when a real user would be stuck the same way, for instance a button
    permanently covered by a banner. A stale or unknown reference is your
    mistake, never an issue.
  - `sandbox_blocked` means the test sandbox stopped a request to an origin
    outside the app under test. **Never report it as an issue.**
  - `console_errors` and `network_errors` belong to the action that returned
    them.
- **Signals are facts, not guesses.** `haunt_spawn` and every `haunt_act`
  return `signals`: what the engine detected by itself, without you having
  to notice it — HTTP errors, uncaught exceptions and rejections,
  `console.error`, failed, hung and slow requests, long main-thread blocks,
  dead controls, and accessibility violations (each page is audited with
  axe-core the first time it is reached). Each carries an `id` (`s3`), the
  `step` that caused it, a default `severity` and a `message`. A signal
  marked `late` comes from an earlier step. `feedback: false` on an error
  means the page said nothing to the user about it: a silent failure.
  - Build your issues on them: when an issue is about a signal, put its id
    in the issue's `"signal"` field. The report then shows the signal under
    your issue instead of on its own. Raise or lower the severity when the
    user impact calls for it.
  - Do not report the same fact twice, and do not invent one: a signal you
    do not turn into an issue still reaches the report, under "Detected
    automatically".
- **Every issue must be checkable.** It names a signal (`"signal"`), or it
  states what the page shows in `"observed"`: exactly one of `text_present`,
  `text_absent`, `url`, or `element` (`{ "ref": "e12", "state": "disabled" }`),
  with the `step` after which it holds (the last step if left out). "No
  error message after submitting an invalid email" is
  `"observed": { "text_absent": "valid email", "step": 4 }`.
  - When the session ends, `haunt_end_session` replays every issue in a
    fresh browser. One reproduced every time is **confirmed**; one
    reproduced only some of the time is **flaky**, with its rate; one never
    reproduced, or with neither a signal nor an observation, is
    **rejected** and does not reach the report. Each confirmed or flaky
    issue comes with an evidence bundle (steps, screenshot, trace) that
    `haunt_replay` plays again.
  - A pure opinion ("this label is confusing") is not checkable: leave it
    out.
  - `haunt_capture_state` with `signals: true` lists the signals of the
    current page; with `audit: true` it audits the page again as it is now
    (after a dialog or a panel opened, for instance).
- If a dialog opens, answer it with a `dialog` action before anything else.

### Phase 0.5 — Auth (only if --email and --password are provided)

If credentials are present:

Print: `logging in as <email>...`

- If `--debug-auth`: print `  · auth flow started`

1. `haunt_spawn` at `target_url` with timeout: 10
   - If `--debug-auth`: print `  · browser opened`
2. `haunt_capture_state` — look for a login form, or a link to one
   - If `--debug-auth`: print `  · page loaded`
3. If there is no password field on the page, `haunt_act` — click the link that leads to the login page ("Login", "Sign in", "Se connecter"…), then `haunt_capture_state` again
   - If `--debug-auth`: print `  · login form found at <url>`
4. `haunt_act` with three actions in one call: fill the email field, fill the password field, click the submit button of that form (the button after the password field, not a navigation link that happens to read "Log in")
   - If `--debug-auth`: print `  · credentials submitted`
5. Check the result of that call: the URL is no longer the login page, or `haunt_capture_state` shows a logged-in element (avatar, dashboard, username)
   - If `--debug-auth`: print `  · checking session...`
6. `haunt_get_cookies` — extract the session cookies
   - If `--debug-auth`: print `  · cookies captured (<N>)`
7. `haunt_end_session`

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
Call `haunt_capture_state`.

**Read real links from the snapshot** — every `link` line ends with its
destination (`-> /pricing`). Keep the distinct paths on the target's own
origin. Do NOT guess common routes like /login or /dashboard unless you
actually see them in the snapshot.

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

A "step" is one decision per session: one `haunt_act` call, which may carry
several actions. Spawn each session with `timeout` set to `steps × 5`.

1. `haunt_spawn` for every area in a single message (all in parallel). If auth cookies were captured in Phase 0.5, pass them via the `cookies` parameter to every `haunt_spawn` call.
   Keep track of which area each returned `session_id` belongs to — Phase 3 needs it.
2. `haunt_capture_state` for all sessions — all in parallel.
3. Reason as each persona with a **corner-case mindset — NOT the happy path** (silently unless `--verbose`):
   - What non-obvious action would this user take that a developer would never think to test?
   - What happens if they submit empty forms, enter wrong data types, go back after submitting?
   - What if they navigate directly to a URL they shouldn't have access to?
   - What breaks when they don't follow the expected flow?
   Prioritize unexpected behavior over intended flows.
4. `haunt_act` for all sessions in a single message, with any `issues` spotted.
   Choose corner-case actions: submit empty forms, enter bad data, access protected URLs directly, trigger the same action twice.
   Read each result as described in "How to act on a page" — what changed, what failed and why, which `signals` it brought — and turn what a real user would suffer from into issues for the next call, naming the signal each one is about.
5. Repeat capture → act up to `steps - 1` more times.
6. `haunt_end_session` for all sessions in a single message. Pass in its `issues` whatever the result of the last action revealed — no later call would carry it.

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
(name or value) into any of those fields. If something you captured (a page snapshot)
happens to contain one, redact it (e.g. `[redacted]`) before including it.

For each session, gather:
- `area` — the route it tested (tracked in Phase 2, step 1)
- `persona` — the persona's display name
- `overall_impression` — from that session's `EndSessionOutput`
- `issues` — that session's `EndSessionOutput.issues_found`
- `sandbox_blocked_requests` — that session's `EndSessionOutput.sandbox_blocked_requests`
- `signals` — that session's `EndSessionOutput.signals`, exactly as returned
- `rejected` — that session's `EndSessionOutput.rejected`, exactly as returned
- `issues` are passed exactly as returned too, with their `verification`: the
  report lists confirmed ones as issues, and flaky and unverified ones apart

Call `haunt_generate_report` with `target_url`, `personas` (the list used this run),
`sessions` (the array assembled above), and — if `--compare <path>` was given —
`compare_with: <path>`.

**Print exactly the `summary` field the tool returns.** Do not reconstruct it yourself.
If `compare_with` was passed and the tool returns a `comparison_error`, that means the
path couldn't be read (e.g. typo, or a report from before comparison support existed)
— this is not a failure of the run itself, just note it's not comparable.
