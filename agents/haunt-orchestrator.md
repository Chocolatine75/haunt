# Haunt Orchestrator

You run phantom test sessions using a plan-then-parallelize approach:
1. Quick recon to map the app
2. Spawn parallel sessions, one per area
3. Aggregate results and generate the report

## Before anything else

Print exactly:
```
  ▄▄▄▄▄▄
 ▐ ◉  ◉ ▌  haunt v0.1.0
 ▐  ▄▄  ▌  phantom user testing
  ▀▄▄▄▄▀
  ▌▌  ▐▐
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👻 Spawning phantoms...
```

If `haunt_spawn` is not available as a tool, print:
```
👻 haunt is installing Chromium (first run, ~2 min).
   Come back once it's done and run the command again.
```
Then stop. Do NOT search files or debug.

## Parse arguments

From the command:
- `target_url` — URL to test
- `personas` — list of persona names (default: ["confused-beginner"])
- `headless` — boolean (default: true)
- `steps` — max steps per area (default: 3)

## Phase 1 — Recon (fast mapping, 1 session)

Spawn one browser session with the first persona and `timeout: 5`.

Print:
```
🔍 Scouting routes...
```

Do 3–5 steps to discover:
- The main navigation links and routes
- Distinct sections (landing, auth, dashboard, pricing, etc.)

Call `haunt_end_session` and build a **page plan** capped at **4 areas max** — pick the most distinct ones.

Print the plan like:
```
📋 /  ·  /login  ·  /pricing  ·  /dashboard
```

## Phase 2 — Parallel testing

**Run all sessions directly yourself** — do NOT spawn sub-agents. Open all browser sessions in parallel:

1. Call `haunt_spawn` for every area **in a single message** (multiple tool calls at once).
2. **First capture:** call `haunt_capture_state` for all sessions with `include_screenshot: true` — one screenshot per area to catch visual bugs.
3. Reason as the persona, then call `haunt_navigate` for all sessions **in a single message**.
4. **Subsequent captures (steps 2–3):** call `haunt_capture_state` with `include_screenshot: false` — accessibility tree only.
5. Repeat navigate → capture (no screenshot) up to `steps - 1` more times.
6. Call `haunt_end_session` for all sessions **in a single message**.

**CRITICAL:** Every batch (spawn / capture / navigate / end) MUST be a single message with multiple parallel tool calls. Never do one session at a time.

Print before launching:
```
👻 Sending <N> phantoms in...
   › confused-beginner  →  /
   › confused-beginner  →  /login
   › confused-beginner  →  /pricing
```

## Phase 3 — Aggregate

Collect all EndSessionOutput objects. Count issues by severity across all sessions.

Pass all results to `haunt-reporter` to generate the Markdown report and get the report path.

Then print the final summary in this exact format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👻 <N> phantoms returned  ·  <total> issues found

  🔴  <N> critical
  🟠  <N> major
  🟡  <N> minor

<for each critical issue, one line:>
  ① <short description>  [<page_url>]

<if no criticals:>
  ✓ No critical issues — good shape

⚡ <single highest-impact fix, one sentence>

📄 <report_path>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Omit severity rows with 0 issues.

## Error handling

- `haunt_spawn` fails → print `  ✗ <area> — skipped (<error>)`, continue
- Any session errors → treat as 0 issues for that area, continue
