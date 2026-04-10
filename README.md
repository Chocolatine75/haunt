# Haunt

**AI phantom users that test your app while you code.**

Haunt spawns browser agents that navigate your localhost like real users would — a confused beginner, a malicious attacker, a screen reader user. Each phantom explores your app, logs what breaks, and hands you an actionable report.

```
/haunt:haunt-test http://localhost:3000
```

```
haunt v0.1.0
──────────────────────────────────────────
🔍 Mapping app structure...
📋 Plan: / | /login | /pricing | /dashboard

🚀 Launching 4 agents in parallel...
   confused-beginner → /
   confused-beginner → /login
   confused-beginner → /pricing
   confused-beginner → /dashboard

──────────────────────────────────────────
✓ All sessions complete
  4 areas tested | 15 issues found
  4 critical · 9 major · 2 minor

Report: .haunt-reports/2026-04-10-confused-beginner.md
```

---

## What it finds

Real bugs, caught before your users do:

- **Broken auth flows** — login crashes, dashboard accessible without a session
- **Exposed internals** — stack traces and env var names leaking to the browser console
- **Missing content** — 404 videos, empty sections, broken CTAs
- **Accessibility gaps** — buttons with no label, missing ARIA, keyboard traps
- **UX friction** — confusing copy, dead-end flows, duplicate routes

---

## Install

```
/plugin marketplace add Chocolatine75/haunt
/plugin install haunt
/reload-plugins
```

That's it. No API key required. Chromium installs automatically on first run.

> **Requires:** Claude Code · Node.js 18+

---

## Usage

```bash
# Test with the default persona
/haunt:haunt-test http://localhost:3000

# Test multiple personas
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user

# Watch the browser in real time
/haunt:haunt-test http://localhost:3000 --headed

# Faster scan (fewer steps per area)
/haunt:haunt-test http://localhost:3000 --steps 3
```

Reports are saved to `.haunt-reports/`.

---

## Built-in personas

| Persona | Simulates | Finds |
|---|---|---|
| `confused-beginner` | First-time user, no prior context | UX friction, broken flows, missing onboarding |
| `malicious-user` | Attacker probing for weaknesses | Auth bypasses, exposed data, injection vectors |
| `screen-reader-user` | Keyboard-only navigation | Missing ARIA, focus traps, inaccessible controls |

---

## Custom personas

Drop a YAML file anywhere in your project:

```yaml
name: Impatient Power User
description: Moves fast, skips instructions, expects things to just work
system_prompt: |
  You are an experienced user who moves quickly and has no patience for unclear UI.
  You skip tutorials, click fast, and get frustrated when things don't work as expected.
browser:
  headless: true
  viewport: { width: 1440, height: 900 }
scenarios:
  - name: Core workflow
    goal: Complete the main task as fast as possible
    max_steps: 10
```

```bash
/haunt:haunt-test http://localhost:3000 --personas ./personas/power-user.yaml
```

See `personas/confused-beginner.yaml` for the full format.

---

## How it works

Haunt is a [Claude Code](https://claude.ai/code) plugin built on three layers:

1. **MCP server** — controls a real Chromium browser via Playwright
2. **Orchestrator agent** — maps your app, then dispatches parallel sub-agents
3. **Persona agents** — each runs as a specific user type, reporting issues as they navigate

No AI vision required for navigation — the orchestrator reads the accessibility tree and acts on it, the same way a screen reader would.

---

## License

MIT
