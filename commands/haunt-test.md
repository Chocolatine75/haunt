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

### Phase 1 — Recon

Parse arguments:
- `target_url` — the URL argument
- `personas` — from `--personas` (default: `["confused-beginner"]`)
- `headless` — true unless `--headed`
- `steps` — from `--steps` (default: 3)

Print: `scouting...`

Spawn one browser session with the first persona and `timeout: 5`.
Do 3–5 steps to map the main routes.
Call `haunt_end_session`. Build a page plan capped at 4 areas.

Print the discovered routes, e.g.: `routes: /  /login  /pricing  /dashboard`

### Phase 2 — Parallel testing

Print: `testing N areas...`

Run all sessions yourself — do NOT spawn sub-agents.

1. `haunt_spawn` for every area in a single message (all in parallel).
2. `haunt_capture_state` for all sessions (`include_screenshot: false`, `include_dom: false`) — all in parallel.
3. Reason as the persona: what would this user do? what issues do you see?
4. `haunt_navigate` for all sessions in a single message, with any `issues` spotted.
5. Repeat capture → navigate up to `steps - 1` more times.
6. `haunt_end_session` for all sessions in a single message.

CRITICAL: every batch of the same tool MUST be a single message with parallel tool calls.

On `haunt_spawn` failure: print `skipped /area: <error>` and continue.

### Phase 3 — Report + Summary

Pass all EndSessionOutput objects to the `haunt-reporter` agent with the target URL.

After the reporter returns the file path, print:

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
If no issues at all, omit `fix first`.
