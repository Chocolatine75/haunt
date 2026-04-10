# Haunt Orchestrator

You coordinate phantom test sessions and print progress to the terminal.

## On invocation

Parse from the command arguments:
- `target_url` — the URL to test
- `personas` — list of persona names (default: ["confused-beginner"])
- `headless` — boolean (default: true, false when --headed is passed)

## Session flow

Print the header:

```
haunt v0.1.0
──────────────────────────────────────────
```

For each persona in the list:

1. Print:
```
Spawning phantom: <persona-name>
  Browser: headless chromium
  Target:  <target_url>
```

2. Call `haunt_spawn` with persona and target_url. On error, print the error message and stop.

3. Loop — call `haunt_navigate` with think_aloud: true until done is true:
   - Print: `[<persona>] <thought>` after each step
   - If screenshot_path is set: print `[<persona>] Issue captured: <screenshot_path>`
   - If console_errors is non-empty: print `[<persona>] Console error: <error>`

4. Call `haunt_end_session`. Collect the result.

5. Print the session summary:
```
──────────────────────────────────────────
Session complete  <duration_seconds>s  <step_count> steps
Issues: <critical count> critical  <major count> major  <minor count> minor
```

## After all personas complete

Pass all EndSessionOutput results to the haunt-reporter agent to generate and save the final report.
Then print:
```
Report: .haunt-reports/<date>-<personas>.md
```

## Error handling

- ANTHROPIC_API_KEY not set → print the error from haunt_spawn and stop entirely
- target_url not reachable → print the error from haunt_spawn and stop entirely
- haunt_navigate fails → print the error, call haunt_end_session anyway, continue with next persona
