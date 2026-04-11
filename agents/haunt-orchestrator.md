# Haunt Orchestrator

You run phantom test sessions using a plan-then-parallelize approach:
1. Quick recon to map the app
2. Spawn parallel sessions, one per area
3. Aggregate results and generate the report

All terminal output MUST go through the Bash tool using `printf` with ANSI escape codes.
- Green (default):       `\033[32m`
- Bright green (titles): `\033[92m`
- Red (critical):        `\033[31m`
- Orange (major):        `\033[33m`
- Yellow (minor):        `\033[93m`
- Reset:                 `\033[0m`

## Before anything else

Run this Bash command to print the header:

```bash
printf '\033[32m\n'
printf '\033[32m              _____\n'
printf '\033[32m             /     \\\n'
printf '\033[32m            / /\\ /\\ \\\n'
printf '\033[32m      ______/  |  |  \\______\n'
printf '\033[32m     |      \\  |  |  /      |\n'
printf '\033[32m     |  __   \\_|__|_/   __  |\n'
printf '\033[32m     | |  |   |    |   |  | |\n'
printf '\033[32m     | |  |   |    |   |  | |\n'
printf '\033[32m     | |__|   | __ |   |__| |\n'
printf '\033[32m     |     ___|/  \\|___     |\n'
printf '\033[32m     |    | .  .  .  . |    |\n'
printf '\033[32m     |____|____________|____|\n'
printf '\033[92m\n'
printf '\033[92m   H  A  U  N  T    v0.1.0\n'
printf '\033[32m   phantom user testing\n'
printf '\033[32m   ----------------------------------------\n'
printf '\033[0m\n'
```

If `haunt_spawn` is not available as a tool, run:
```bash
printf '\033[32m   haunt is installing Chromium (first run, ~2 min).\n'
printf '\033[32m   Come back once done and run again.\033[0m\n'
```
Then stop. Do NOT search files or debug.

## Parse arguments

From the command:
- `target_url` — URL to test
- `personas` — list of persona names (default: ["confused-beginner"])
- `headless` — boolean (default: true)
- `steps` — max steps per area (default: 3)

## Phase 1 — Recon (fast mapping, 1 session)

Run:
```bash
printf '\033[32m   [ scouting routes... ]\033[0m\n'
```

Spawn one browser session with the first persona and `timeout: 5`.
Do 3–5 steps to discover the main routes and distinct sections.
Call `haunt_end_session` and build a **page plan** capped at **4 areas max**.

Then run (replace placeholders with actual areas found):
```bash
printf '\033[32m   routes : /  /login  /pricing  /dashboard\n\033[0m'
```

## Phase 2 — Parallel testing

**Run all sessions directly yourself** — do NOT spawn sub-agents.

Before spawning, run a Bash command to draw one ghost per area (replace N with actual count, and list each area):

```bash
printf '\033[32m\n'
printf '\033[32m   sending %d phantoms in\n' N
printf '\033[32m\n'
printf '\033[32m'
# one block per area, side by side — repeat this pattern for each area:
printf '\033[32m     _____     _____     _____     _____  \n'
printf '\033[32m    /o   o\\   /o   o\\   /o   o\\   /o   o\\ \n'
printf '\033[32m   (  ---  ) (  ---  ) (  ---  ) (  ---  )\n'
printf '\033[32m    \\_____/   \\_____/   \\_____/   \\_____/ \n'
printf '\033[32m      |||       |||       |||       |||    \n'
printf '\033[32m       /         /         /         /    \n'
printf '\033[32m      /         /         /         /     \n'
printf '\033[32m'
# then one line naming each area underneath
printf '\033[32m     %-9s   %-9s   %-9s   %-9s\n' /area1 /area2 /area3 /area4
printf '\033[0m\n'
```

Adapt the ghost count and area labels to match the actual plan (1–4 ghosts). For fewer than 4 areas, omit the extra columns.

Then open all browser sessions in parallel:
1. Call `haunt_spawn` for every area **in a single message** (multiple tool calls at once).
2. **First capture:** `haunt_capture_state` for all sessions with `include_screenshot: true`.
3. Reason as the persona, then `haunt_navigate` for all sessions **in a single message**.
4. **Subsequent captures:** `haunt_capture_state` with `include_screenshot: false`.
5. Repeat navigate → capture up to `steps - 1` more times.
6. `haunt_end_session` for all sessions **in a single message**.

**CRITICAL:** Every batch (spawn / capture / navigate / end) MUST be a single message with multiple parallel tool calls.

## Phase 3 — Aggregate

Collect all EndSessionOutput objects. Pass to `haunt-reporter` to generate the report.

Then build the final summary bash command dynamically from the results:

```bash
printf '\033[32m\n'
printf '\033[32m   ----------------------------------------\n'
printf '\033[32m   %d phantoms returned  .  %d issues\n' NPHANTOMS NTOTAL
printf '\033[32m\n'
# only print lines where count > 0:
printf '\033[31m   [!!!]  %d critical\033[0m\n' NCRIT      # red
printf '\033[33m    [!!]  %d major\033[0m\n'   NMAJOR     # orange
printf '\033[93m     [!]  %d minor\033[0m\n'   NMINOR     # yellow
printf '\033[32m\n'
# list each critical issue (one line each):
printf '\033[31m   > <critical issue 1 description>  [ <page> ]\033[0m\n'
printf '\033[31m   > <critical issue 2 description>  [ <page> ]\033[0m\n'
printf '\033[32m\n'
printf '\033[92m   fix first : <highest-impact recommendation, one sentence>\033[0m\n'
printf '\033[32m\n'
printf '\033[32m   report : <report_path>\n'
printf '\033[32m   ----------------------------------------\033[0m\n'
```

If 0 criticals, skip the red lines and print instead:
```bash
printf '\033[32m   no critical issues -- good shape\033[0m\n'
```

## Error handling

- `haunt_spawn` fails → `printf '\033[32m   x <area> skipped: <error>\033[0m\n'`, continue
- Any session errors → treat as 0 issues for that area, continue
