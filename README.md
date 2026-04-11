# Haunt

**AI phantom users that find what developers never test.**

Haunt spawns browser agents that behave like real users — not the happy path, but the corner cases. A confused beginner who submits empty forms. A malicious user who probes your API routes without a token. A screen reader user who tabs through every element.

They find things developers miss because developers know their own app.

```
/haunt:haunt-test http://localhost:3000 --personas malicious-user
```

```
haunt v0.1.0  —  phantom user testing

scouting...
routes: /  /login  /dashboard  /api/hrflow/profiles  /api/account/searches

testing 4 areas...

----------------------------------------
4 areas tested · 5 issues

[!!!] 2 critical
 [!!] 3 major

> Unauthenticated GET /api/hrflow/profiles exposes 10,000 candidate profiles (name, email, phone, DOB, GPS, full CV)  [/api/hrflow/profiles]
> /dashboard loads for any anonymous user with no redirect to login  [/dashboard]

fix first: add server-side auth to every API route — /api/hrflow/profiles leaks 10,000 PII records to the open internet

report: .haunt-reports/2026-04-11-malicious-user.md
----------------------------------------
```

---

## What it finds

Things only discovered by users who don't know what they're doing — or users who do:

- **Missing auth guards** — protected pages and API routes accessible without a session
- **PII exposure** — API endpoints returning user data with no authentication
- **IDOR vulnerabilities** — user_id in query params, incrementable IDs, enumerable resources
- **Broken form validation** — empty submissions accepted, wrong data types pass, no error feedback
- **Stack traces in the browser** — internal paths, dependency names, database errors exposed
- **Accessibility failures** — keyboard traps, unlabeled buttons, focus lost after modal close
- **UX dead ends** — actions with no feedback, errors with no explanation, flows that silently fail

---

## Install

```
/plugin marketplace add Chocolatine75/haunt
/plugin install haunt
/reload-plugins
```

No API key required. Chromium installs automatically on first run.

> **Requires:** Claude Code · Node.js 18+

---

## Usage

```bash
# Test with the default persona (confused beginner)
/haunt:haunt-test http://localhost:3000

# Security audit
/haunt:haunt-test http://localhost:3000 --personas malicious-user

# Accessibility audit
/haunt:haunt-test http://localhost:3000 --personas screen-reader-user

# Multiple personas
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user

# Watch the browser live
/haunt:haunt-test http://localhost:3000 --headed

# Faster scan
/haunt:haunt-test http://localhost:3000 --steps 2
```

Reports are saved to `.haunt-reports/`.

---

## Built-in personas

| Persona | Behavior | Finds |
|---|---|---|
| `confused-beginner` | Submits empty forms, enters wrong data types, goes back after submit, modifies URLs | Missing validation, silent failures, broken error states |
| `malicious-user` | XSS/SQLi payloads in every input, direct URL access to protected pages, IDOR enumeration | Auth bypasses, PII exposure, injection vectors, server errors |
| `screen-reader-user` | Keyboard-only navigation, triggers modal/focus edge cases, checks ARIA | Focus traps, unlabeled elements, inaccessible error messages |

---

## Custom personas

Drop a YAML file anywhere in your project:

```yaml
name: Impatient Power User
description: Moves fast, skips steps, expects things to just work
system_prompt: |
  You are an experienced user who moves quickly.
  Skip tutorials. Click fast. If something requires more than 2 steps, try to skip one.
  Double-click buttons. Refresh mid-flow. Try keyboard shortcuts that may not exist.
  Report anything that breaks when you don't follow the expected sequence.
browser:
  headless: true
  viewport: { width: 1440, height: 900 }
scenarios:
  - name: Speed run
    goal: Break things by going too fast
    max_steps: 10
```

```bash
/haunt:haunt-test http://localhost:3000 --personas ./personas/power-user.yaml
```

---

## How it works

1. **Recon** — a browser reads real navigation links from your app's DOM to find areas to test
2. **Parallel sessions** — one browser per area, all running simultaneously
3. **Corner-case navigation** — each persona tries unexpected actions, not the happy path
4. **Report** — issues sorted by severity, with concrete fixes and a single highest-impact recommendation

No AI vision required. The browser reads the accessibility tree, the same way a screen reader does.

---

## License

MIT
