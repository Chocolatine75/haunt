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

## First run check

If `haunt_spawn` is not available as a tool, run this and stop:

```bash
printf '\033[32m  haunt is installing Chromium (first run, ~2 min).\033[0m\n'
printf '\033[32m  Come back once done and run again.\033[0m\n'
```

Do NOT investigate or debug. Just print and stop.

## Phase 0 — Header

Run this Bash command first, before anything else:

```bash
printf '\033[32m\n'
printf '\033[32m         /\\\n'
printf '\033[32m        /  \\\n'
printf '\033[32m   ____/    \\____\n'
printf '\033[32m  |   |      |   |\n'
printf '\033[32m  | [=]  []  [=] |    \033[92mH A U N T  v0.1.0\033[32m\n'
printf '\033[32m  |   |      |   |    phantom user testing\n'
printf '\033[32m  |   |  /\\  |   |\n'
printf '\033[32m  |   | /  \\ |   |\n'
printf '\033[32m  |___|/    \\|___|\n'
printf '\033[32m  |   | [==] |   |\n'
printf '\033[32m  |___|______|___|\n'
printf '\033[0m\n'
```

## Parse arguments

From the command input:
- `target_url` — the URL argument (required)
- `personas` — list from `--personas` (default: `["confused-beginner"]`)
- `headless` — true unless `--headed` is present
- `steps` — number from `--steps` (default: 3)

## Phase 1 — Recon

Run:
```bash
printf '\033[32m  [ scouting... ]\033[0m\n'
```

Spawn one browser session with the first persona and `timeout: 5`.
Do 3–5 steps to discover the main routes and distinct sections.
Call `haunt_end_session`. Build a **page plan** capped at **4 areas max**.

Then run (fill in the actual discovered routes):
```bash
printf '\033[32m  routes : / /login /pricing /dashboard\033[0m\n'
```

## Phase 2 — Ghost row

Print one ghost per area (1–4), adapted to the number of areas. Run the matching Bash command:

**1 area:**
```bash
printf '\033[32m\n'
printf '\033[32m     ,---.\n'
printf '\033[32m    / o o \\\n'
printf '\033[32m   |       |\n'
printf '\033[32m    \\_^_^_/\n'
printf '\033[32m      /url\n'
printf '\033[0m\n'
```

**2 areas:**
```bash
printf '\033[32m\n'
printf '\033[32m     ,---.       ,---.\n'
printf '\033[32m    / o o \\     / o o \\\n'
printf '\033[32m   |       |   |       |\n'
printf '\033[32m    \\_^_^_/     \\_^_^_/\n'
printf '\033[32m     /url1        /url2\n'
printf '\033[0m\n'
```

**3 areas:**
```bash
printf '\033[32m\n'
printf '\033[32m     ,---.       ,---.       ,---.\n'
printf '\033[32m    / o o \\     / o o \\     / o o \\\n'
printf '\033[32m   |       |   |       |   |       |\n'
printf '\033[32m    \\_^_^_/     \\_^_^_/     \\_^_^_/\n'
printf '\033[32m     /url1        /url2        /url3\n'
printf '\033[0m\n'
```

**4 areas:**
```bash
printf '\033[32m\n'
printf '\033[32m     ,---.    ,---.    ,---.    ,---.\n'
printf '\033[32m    / o o \\  / o o \\  / o o \\  / o o \\\n'
printf '\033[32m   |       ||       ||       ||       |\n'
printf '\033[32m    \\_^_^_/  \\_^_^_/  \\_^_^_/  \\_^_^_/\n'
printf '\033[32m     /url1    /url2    /url3    /url4\n'
printf '\033[0m\n'
```

Replace `/url1`, `/url2`, etc. with the actual area paths.

## Phase 3 — Parallel testing

Run all sessions **yourself** — do NOT spawn sub-agents.

1. `haunt_spawn` for every area **in a single message** (all in parallel).
2. `haunt_capture_state` for all sessions with `include_screenshot: false`, `include_dom: false` — all in parallel.
3. Reason as the persona: what would this user do? any issues visible?
4. `haunt_navigate` for all sessions **in a single message**, with any `issues` you spotted.
5. Repeat capture → navigate up to `steps - 1` more times.
6. `haunt_end_session` for all sessions **in a single message**.

**CRITICAL:** Every batch of the same tool MUST be a single message with multiple parallel tool calls.

On `haunt_spawn` failure for an area: run
```bash
printf '\033[33m  x /area skipped: error message\033[0m\n'
```
and continue with the remaining areas.

## Phase 4 — Report

Collect all EndSessionOutput objects. Delegate to the `haunt-reporter` agent to generate the report file. Pass it all session outputs and the target URL.

## Phase 5 — Summary

After the reporter returns the saved file path, compute totals from the session outputs and run:

```bash
printf '\033[32m  ----------------------------------------\033[0m\n'
printf '\033[32m  N phantoms returned  .  TOTAL issues\033[0m\n'
printf '\n'
# only print lines where count > 0:
printf '\033[31m  [!!!]  N critical\033[0m\n'
printf '\033[33m   [!!]  N major\033[0m\n'
printf '\033[93m    [!]  N minor\033[0m\n'
printf '\n'
# if there are criticals, list first 2:
printf '\033[31m  >  description of critical issue 1  [ /page ]\033[0m\n'
printf '\033[31m  >  description of critical issue 2  [ /page ]\033[0m\n'
printf '\n'
# if no criticals:
printf '\033[32m  no critical issues\033[0m\n'
printf '\n'
# if any issues, print top fix:
printf '\033[32m  fix first : one-sentence highest-impact recommendation\033[0m\n'
printf '\n'
printf '\033[32m  report    : .haunt-reports/YYYY-MM-DD-persona.md\033[0m\n'
printf '\033[32m  ----------------------------------------\033[0m\n'
```

Fill in real values. Omit severity lines where count is 0. Omit `fix first` if no issues at all.
