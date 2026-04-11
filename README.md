<img width="1024" height="254" alt="image" src="https://github.com/user-attachments/assets/4850ae4a-af1f-44a5-9ce8-1ca062553939" />

---

You vibe-coded the feature. You tested it yourself. It works.

You know where to click, what to fill in, how the flow goes — because you built it.

**Your users don't.**

They'll submit the form empty and get a blank screen. They'll land on a page they shouldn't have access to. They'll type something weird in a field and hit a 500. They'll find the API endpoint that returns everyone's data with no auth.

You won't catch this by testing it yourself. You never do.

---

**Haunt runs before you deploy.**

It spawns phantom users against your localhost — a confused beginner who does everything wrong, a malicious user who probes every input and route, a keyboard-only user who tabs through everything. They don't know your app. They find what real users find.

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

> Unauthenticated GET /api/hrflow/profiles exposes 10,000 candidate profiles with full PII  [/api/hrflow/profiles]
> /dashboard loads for any anonymous user — no auth redirect  [/dashboard]

fix first: add server-side auth to every API route before deploying

report: .haunt-reports/2026-04-11-malicious-user.md
----------------------------------------
```

---

## Install

```
/plugin marketplace add Chocolatine75/haunt
/plugin install haunt
/reload-plugins
```

No API key. No config. Chromium installs automatically on first run.

> **Requires:** Claude Code · Node.js 18+

---

## Usage

```bash
# Default — confused beginner who does everything wrong
/haunt:haunt-test http://localhost:3000

# Security pass — probes auth, APIs, inputs
/haunt:haunt-test http://localhost:3000 --personas malicious-user

# Accessibility pass — keyboard only
/haunt:haunt-test http://localhost:3000 --personas screen-reader-user

# Full sweep
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user

# Watch it live
/haunt:haunt-test http://localhost:3000 --headed
```

Reports land in `.haunt-reports/`.

---

## What it finds

| Persona | Does | Catches |
|---|---|---|
| `confused-beginner` | Submits empty forms, enters wrong data, modifies URLs, goes back after submit | Missing validation, silent failures, broken error states |
| `malicious-user` | XSS/SQLi in every input, direct access to protected routes, IDOR enumeration | Auth bypasses, PII exposure, injection vectors, leaked stack traces |
| `screen-reader-user` | Keyboard-only, triggers every modal and focus edge case | Focus traps, unlabeled buttons, inaccessible errors |

---

## Custom personas

```yaml
name: Impatient Power User
description: Moves fast, skips steps, expects things to just work
system_prompt: |
  You move fast and skip instructions.
  Double-click buttons. Refresh mid-flow. Skip required steps and submit anyway.
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

## License

MIT
