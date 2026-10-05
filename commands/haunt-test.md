# /haunt-test

Test a running web application the way a QA engineer would, and report what is
wrong with it.

## Usage

/haunt-test <url> [--spec <file>] [--steps N] [--headed] [--verbose]

## Arguments

- `url` — Target URL (required). Must be a running server, e.g. http://localhost:3000
- `--spec` — A file describing what the app is meant to do (a README, a
  requirements page). Given to the planner and the testers as it is: what it
  says the app does is what they hold it to.
- `--steps` — The budget of actions of each tester (default: 40)
- `--headed` — Show the browser window in real time (default: headless)
- `--routes` — Comma-separated paths to test directly (e.g. `/signup,/pricing`),
  skipping Phase 1's route discovery. Use when you already know which areas
  matter, or when scouting misses or over-picks routes.
- `--compare` — Path to a previous report (its `.md` path) to diff this run
  against. The final report and summary annotate each issue as new vs. still
  present, and list issues from that run that no longer reproduce.
- `--email` — Email to log in with before testing
- `--password` — Password to log in with (use with --email)
- `--debug-auth` — Print each auth step verbosely (use when auth fails silently)
- `--hostile` — Also plan attack payloads (script injection, forged
  parameters). Only against an app you own.
- `--yes` — Skip the cost estimate confirmation prompt (for scripted use)
- `--verbose` — Print intermediate reasoning and observations between tool calls (default: silent)

## First run

If `haunt_spawn` is not available as a tool, print:

```
haunt is installing Chromium (first run, ~2 min).
Come back once done and run again.
```

Then stop. Do NOT debug.

## Who does what

You are the orchestrator. You find the areas to test, hand each to a
**planner**, hand the planner's cases to **testers**, and assemble the report.
You test nothing yourself: an agent that plans, acts and judges in one context
does each of them worse.

- `haunt-planner` reads one area and writes its test cases. It cannot act on
  the page: it has no tool for it.
- `haunt-tester` plays the cases it is handed, in a browser session of its own,
  and reports what is wrong.

Both are agents of this plugin; spawn them with the Agent tool. What follows
describes haunt's tools, which you use for scouting and logging in and which
the agents use for the rest.

## Behavior

### Phase 0 — Header

Print exactly:

```
haunt v0.2.0  —  QA testing
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
  `expected: true` on a 401 or 403 means a sign-in refused as it should be
  (a wrong password, and the page said so): not an issue, unless the
  password was the right one.
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
- **Say what you expect before you act, and let the engine check it.**
  `haunt_plan` returns the session's inventory: every control it was shown,
  with its group, its state, and whether an action has exercised it yet.
  Register a test case for what you are about to try
  (`"cases": [{ "id": "titles-only", "kind": "normal", "controls": ["e2"],
  "expect": "With Titles only on, every result's title contains the word" }]`),
  then pass `"case"` and `"expect"` to the `haunt_act` call that plays it.
  `expect` is an observation as above, or one of two more:
  - `list`: the items of a container, read exactly as the page shows them,
    and what must be true of them.
    `{ "list": { "within": { "role": "list", "name": "Results" }, "items":
    "heading", "every_contains": "garlic" } }`. Conditions: `count` (`eq`,
    `min`, `max`), `every_contains`, `none_contains`, `order` (`ascending` or
    `descending`, `"as": "number"` for prices and counts), `equals` (the
    exact items). `haunt_capture_state` with `list` returns the same items,
    to look before you state.
  - `value`: what a control holds or its state.
    `{ "value": { "ref": "e4", "of": "checked", "is": true } }`, with `of`
    one of `value`, `checked`, `expanded`, `pressed`, `focused`.
  The result carries `expectation: { held, read }`, and the case gets its
  verdict. A failed case is an issue's claim: file the issue with
  `"case": "titles-only"` instead of an observation.
  - `haunt_plan` again shows the coverage: controls exercised of those
    listed, cases run, and what is left. From three quarters of the
    session's budget every result lists what is still untouched.
- If a dialog opens, answer it with a `dialog` action before anything else.

### Phase 0.5 — Auth (only if --email and --password are provided)

If credentials are present:

Print: `logging in as <email>...`

- If `--debug-auth`: print `  · auth flow started`

1. `haunt_spawn` at `target_url` with `budget: 10`
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

Store the cookies. Hand them to every planner and tester in Phase 2, with the email and password as secrets: the sessions never type them, and haunt keeps them out of every bundle only if it knows them.

If login fails (still on login page after submit, or error visible):
- If `--debug-auth`: print `  · login failed — session not detected`
Print `login failed — check your credentials` and stop.

### Phase 1 — Recon (route discovery from real links)

Parse arguments:
- `target_url` — the URL argument
- `spec` — the content of the file given with `--spec`, read with the Read
  tool; none if not given
- `budget` — from `--steps` (default: 40)
- `headless` — true unless `--headed`
- `hostile` — true only if `--hostile`
- `routes` — from `--routes`, comma-separated, or empty if not given

**If `--routes` was given, skip discovery entirely**: the areas are exactly
those paths (each resolved against `target_url`'s origin), in the order given —
no cap at 4. Print `routes (manual): <path1>  <path2>  ...` and go straight to
Phase 1.5.

Otherwise, discover routes from the real page:

Print: `scouting...`

`haunt_spawn` one session on `target_url` with `budget: 5`, then
`haunt_capture_state`.

**Read real links from the snapshot** — every `link` line ends with its
destination (`-> /pricing`). Keep the distinct paths on the target's own
origin. Do NOT guess common routes like /login or /dashboard unless you
actually see them in the snapshot.

Call `haunt_end_session`. Keep up to 4 areas from the **real links you found**,
the target itself first. If fewer than 4 real routes exist, test those — do
not pad with guesses.

Print the discovered routes, e.g.: `routes: /  /login  /pricing  /dashboard`

### Phase 1.5 — Cost estimate

Call `haunt_estimate_cost` with `route_count` (the number of areas, max 4) and
`steps_per_route` (the budget).

Print exactly:

```
<summary_line from the tool output>
proceed? [y/N]
```

- If `--yes` flag is present: skip the prompt and continue directly to Phase 2.
- Otherwise: wait for user input.
  - If user types `y` or `yes`: continue to Phase 2.
  - Any other input (including Enter alone): print `aborted.` and stop.

### Phase 2 — Plan, then test

Print: `planning N areas...`

**SILENCE RULE: unless `--verbose` is passed, print NOTHING between tool calls. No step labels, no reasoning summaries, no observations. Zero text output between the `planning N areas...` line and the final summary block.**

**2a. One planner per area, all in a single message (in parallel).** Spawn a
`haunt-planner` agent for each area with this, and nothing else:

```
Area: <full URL of the area>
Headless: <true|false>
Cookies: <the cookies captured in Phase 0.5, as JSON, or "none">
Secrets: <the email and password, or "none">
Hostile cases allowed: <yes|no>
Budget of each tester: <budget> actions
<if a spec was given:>
What the app is meant to do:
<the spec, as it is>
```

Each planner answers with the id of its session and its cases grouped for the
testers: up to 3 groups per area, each a list of case ids that belong together
(one form, one list with its filters, one dialog). A planner that found
nothing to test on its area answers with no group: that area gets one tester
with no case, which explores.

On a planner's failure: print `skipped /area: <error>` and continue without
that area.

Print: `testing M groups...`

**2b. One tester per group, all in a single message (in parallel).** Spawn a
`haunt-tester` agent for each group with this, and nothing else:

```
Area: <full URL of the area>
Headless: <true|false>
Cookies: <as above>
Secrets: <as above>
Hostile cases allowed: <yes|no>
Budget: <budget> actions
Planner's session: <the planner's session id>
Your cases: <the ids of this group, comma-separated, or "none: explore">
<if a spec was given:>
What the app is meant to do:
<the spec, as it is>
```

Each tester answers with the id of its session, ended, and a sentence or two
on what it found. Keep track of which area each session id belongs to.

CRITICAL: the planners go in one message, and the testers in one message.
Never spawn them one after the other.

On a tester's failure: print `skipped /area: <error>` and continue.

### Phase 3 — Report

Do NOT hand-write the report file yourself — `haunt_generate_report` computes
the counts, sorts the issues, counts the coverage across the testers, renders
the markdown, picks the file path, and writes it to `.haunt-reports/`. Your job
in this phase is only to tell it which sessions to report on, and print its
output.

**Never let credentials reach the report.** The `overall_impression` strings
are your own text. Never put the value of `--password`, `--email`, or any
cookie (name or value) into them.

Call `haunt_generate_report` with:
- `target_url`
- `sessions`: one entry per **tester** session, as
  `{ "session_id": "<id>", "area": "<its route, e.g. /signup>",
  "overall_impression": "<what the tester said it found>" }`. The server has
  each ended session's issues, signals, cases and inventory: do not copy them.
  The planners' sessions are not reported: they tested nothing.
- `spec`: the name of the `--spec` file, if one was given
- `compare_with: <path>`, if `--compare <path>` was given

**Print exactly the `summary` field the tool returns.** Do not reconstruct it yourself.
If `compare_with` was passed and the tool returns a `comparison_error`, that means the
path couldn't be read (e.g. typo, or a report from before comparison support existed)
— this is not a failure of the run itself, just note it's not comparable.
