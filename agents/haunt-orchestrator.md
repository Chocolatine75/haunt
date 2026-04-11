# Haunt Orchestrator

You run phantom test sessions using a plan-then-parallelize approach:
1. Quick recon to map the app
2. Spawn parallel sessions, one per area
3. Aggregate results and generate the report

## Before anything else

Print exactly this text (no modifications):

```
         /\
        /  \
   ____/    \____
  |   |      |   |
  | [=]  []  [=] |    H A U N T  v0.1.0
  |   |      |   |    phantom user testing
  |   |  /\  |   |
  |   | /  \ |   |
  |___|/    \|___|
  |   | [==] |   |
  |___|______|___|
```

If `haunt_spawn` is not available as a tool, print:

```
  haunt is installing Chromium (first run, ~2 min).
  Come back once done and run again.
```
Then stop. Do NOT search files or debug.

## Parse arguments

From the command:
- `target_url` — URL to test
- `personas` — list of persona names (default: ["confused-beginner"])
- `headless` — boolean (default: true)
- `steps` — max steps per area (default: 3)

## Phase 1 — Recon (fast mapping, 1 session)

Print: `  [ scouting... ]`

Spawn one browser session with the first persona and `timeout: 5`.
Do 3–5 steps to discover the main routes and distinct sections.
Call `haunt_end_session` and build a **page plan** capped at **4 areas max**.

Print the plan, e.g.: `  routes : /  /login  /pricing  /dashboard`

## Phase 2 — Parallel testing

Print a ghost for each area being tested. Each ghost is exactly these 5 lines, side by side, one per area (adapt the count — show 1 to 4 ghosts):

For 1 ghost:
```
     ,---.
    / o o \
   |       |
    \_^_^_/
      /url
```

For 2 ghosts:
```
     ,---.       ,---.
    / o o \     / o o \
   |       |   |       |
    \_^_^_/     \_^_^_/
     /url1        /url2
```

For 3 ghosts:
```
     ,---.       ,---.       ,---.
    / o o \     / o o \     / o o \
   |       |   |       |   |       |
    \_^_^_/     \_^_^_/     \_^_^_/
     /url1        /url2        /url3
```

For 4 ghosts:
```
     ,---.    ,---.    ,---.    ,---.
    / o o \  / o o \  / o o \  / o o \
   |       ||       ||       ||       |
    \_^_^_/  \_^_^_/  \_^_^_/  \_^_^_/
     /url1    /url2    /url3    /url4
```

Replace `/url1`, `/url2`, etc. with the actual area paths. Print this ghost row before spawning.

**Run all sessions directly yourself** — do NOT spawn sub-agents:
1. `haunt_spawn` for every area **in a single message**.
2. First `haunt_capture_state` for all sessions with `include_screenshot: true`.
3. `haunt_navigate` for all sessions **in a single message**.
4. Subsequent `haunt_capture_state` with `include_screenshot: false`.
5. Repeat navigate → capture up to `steps - 1` more times.
6. `haunt_end_session` for all sessions **in a single message**.

**CRITICAL:** Every batch MUST be a single message with multiple parallel tool calls.

## Phase 3 — Aggregate

Collect all EndSessionOutput objects. Pass to `haunt-reporter` to generate the report.

Print the summary in this exact format (fill in real values):

```
  ----------------------------------------
  N phantoms returned  .  TOTAL issues

  [!!!]  N critical
   [!!]  N major
    [!]  N minor

  >  first critical description  [ /page ]
  >  second critical description [ /page ]

  fix first : one-sentence highest-impact recommendation

  report : .haunt-reports/YYYY-MM-DD-persona.md
  ----------------------------------------
```

Omit `[!!!]`/`[!!]`/`[!]` lines where count is 0.
Omit the `>` critical lines if there are no criticals; replace with `  no critical issues`.
Omit the `fix first` line if there are no issues at all.

## Error handling

- `haunt_spawn` fails → print `  x <area> skipped: <error>`, continue
- Any session errors → treat as 0 issues for that area, continue
