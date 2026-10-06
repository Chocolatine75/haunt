# /haunt-test

Test a running web application the way a QA engineer would, and report what is
wrong with it.

## Usage

/haunt-test <url> [--spec <file>] [--steps N] [--no-sweep] [--headed] [--verbose]

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
- `--no-sweep` — Do not press, at the end, the buttons no tester pressed
  (by default the engine presses each once, outside forms, and reports the
  ones that do nothing or throw)
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

### What the tools are

The agents do the testing; this is what you need of the tools yourself, for
logging in and for the report.

`haunt_capture_state` returns a text snapshot: the page's text in reading
order, and every element you can act on as a line such as
`- button "Create account" [e12]`. The part in square brackets is the
element's **reference**. `haunt_act` takes a list of actions that name
elements by reference (`{ "type": "fill", "ref": "e3", "text": "..." }`,
`{ "type": "click", "ref": "e12" }`) and reports what each really changed.

What the testers bring back, and the report shows:

- **signals**: what the engine detected by itself (server errors,
  exceptions, failed and slow requests, dead controls, accessibility
  violations). An issue names the one it is about in `"signal"`.
- **issues**, each with a claim the engine can check: a signal, a test case
  whose expectation did not hold (`"case"`), or a fact about the page in
  `"observed"`. `haunt_end_session` replays each in a fresh browser: one
  reproduced every time is **confirmed**, one reproduced only sometimes is
  **flaky**, one never reproduced is **rejected** and does not reach the
  report. Each confirmed or flaky issue has an evidence bundle that
  `haunt_replay` plays again.
- **coverage**: the controls exercised of those the pages offer and the test
  cases passed, failed and not run, from `haunt_plan`, counted by the engine.

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

Call `haunt_scout` with `target_url` (and the cookies and secrets of Phase
0.5 if there are any). It opens the page, reads its real links and returns
`routes`: the distinct paths on the target's own origin, the target's first,
at most 4. Those are the areas. Do NOT add routes it did not return.

Print the discovered routes, e.g.: `routes: /  /login  /pricing  /dashboard`

### Phase 1.5 — Cost estimate

If `--yes` was given, skip this phase: no call, no prompt.

Otherwise call `haunt_estimate_cost` with `route_count` (the number of areas)
and `steps_per_route` (the budget), and print exactly:

```
<summary_line from the tool output>
proceed? [y/N]
```

Wait for user input. If the user types `y` or `yes`, continue to Phase 2. Any
other input (including Enter alone): print `aborted.` and stop.

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
testers: one group for most areas, up to 3 for an area with many cases. A planner that found
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

**2c. Sweep each area (skip if `--no-sweep` was given).** Once every tester
has answered, call `haunt_sweep` once per area, all in a single message, with
`target_url` (the area's full URL), `sessions` (the ids of the tester
sessions of that area), `headless`, and the cookies and secrets of Phase 0.5
if there are any. No agent: the engine presses the buttons no tester
pressed, outside forms, and keeps what breaks as signals. Each call answers
with the id of a session, already ended: keep it with its area.

On a sweep's failure: continue without it. Say nothing of it.

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
- `sessions`: one entry per **tester** session and one per sweep, as
  `{ "session_id": "<id>", "area": "<its route, e.g. /signup>",
  "overall_impression": "<what the tester said it found>" }`. The server has
  each ended session's issues, signals, cases and inventory: do not copy them.
  For a sweep's session the impression is `engine sweep`. The planners'
  sessions are not reported: they tested nothing.
- `spec`: the name of the `--spec` file, if one was given
- `compare_with: <path>`, if `--compare <path>` was given

**Print exactly the `summary` field the tool returns.** Do not reconstruct it yourself.
If `compare_with` was passed and the tool returns a `comparison_error`, that means the
path couldn't be read (e.g. typo, or a report from before comparison support existed)
— this is not a failure of the run itself, just note it's not comparable.
