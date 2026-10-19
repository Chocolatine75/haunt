<img width="1024" height="254" alt="Haunt" src="https://github.com/user-attachments/assets/4850ae4a-af1f-44a5-9ce8-1ca062553939" />

<div align="center">

**A Claude Code plugin that tests your app the way real users break it.**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet?style=flat-square)](https://claude.ai/code)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](https://github.com/Chocolatine75/haunt/blob/master/LICENSE)
[![Install](https://img.shields.io/badge/install-one%20command-brightgreen?style=flat-square)](#install)

</div>

---

You're shipping faster than ever with AI. You're also shipping more bugs — you just don't know it yet.

Because you test your app the way you built it. You click the right buttons. You fill the right fields. You follow the happy path you designed.

**Your users don't.**

They submit empty forms. They paste garbage into your inputs. They bookmark random URLs. They click "submit" three times before your loading state kicks in. Every one of those moments is a silent churn event you'll never see in your logs.

**Haunt fixes this.** It unleashes AI phantom users on your app while you build — a confused beginner, a user who breaks every input, someone navigating keyboard-only. Real Chromium browser, AI-driven behavior, structured bug report out.

---

## 🔍 What it finds

We ran Haunt on a SaaS app after months of manual testing. 2 minutes, 6 bugs:

```
haunt v0.2.0  —  phantom user testing

scouting...
routes: /  /signup  /dashboard  /pricing

testing 4 areas...

────────────────────────────────────────
4 areas tested · 6 issues found

[!!!] 1 critical
 [!!] 4 major
  [!] 1 minor

> Signup form crashes the server with a 500 on empty submission — no error shown
> Authenticated users can reach /signup and /login with no redirect

fix first: add server-side validation to the signup handler — empty submission
           currently returns a 500, leaving users with a blank broken screen

report: .haunt-reports/2026-04-20-localhost-3000.md
────────────────────────────────────────
```

The developer had tested the signup form. But they'd tested it *knowing what to fill in*.

---

## 🔁 Test → report → fix. One loop.

The report ends with a **"For Claude" section** — paste it into your next prompt and it fixes every issue in order of severity, with the likely file for each one.

```markdown
## For Claude

1. [CRITICAL] http://localhost:3000/signup — Add server-side validation before
   processing signup: check email and password are non-empty, return a 400 with
   an error message if missing. Likely in app/signup/page.tsx.
2. [MAJOR] http://localhost:3000/signup — Add middleware or page-level session
   check to redirect authenticated users to /dashboard. Likely in middleware.ts.
...
```

Find bugs. Read report. Fix with one prompt. Run again.

---

## 🚀 Install

```
/plugin install haunt
/reload-plugins
```

> No API key. No config. Chromium installs itself on first run.
> **Requires:** Claude Code · Node.js 18+

---

## 🎮 Usage

```bash
# Test the app: haunt finds its pages, plans what to test on each, and tests it
/haunt:haunt-test http://localhost:3000

# Watch it happen in real time
/haunt:haunt-test http://localhost:3000 --headed

# Tell it what the app is meant to do, and it holds the app to that
/haunt:haunt-test http://localhost:3000 --spec docs/requirements.md

# Test authenticated areas — Haunt logs in first, then tests
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret

# Also send attack payloads. Only against an app you own
/haunt:haunt-test http://localhost:3000 --hostile
```

Reports saved to `.haunt-reports/` — structured markdown with YAML frontmatter.

Full flag reference: [docs/cli.md](docs/cli.md)

---

## 🧪 How it tests

Haunt works the way a QA engineer does, with one job per agent.

| Who | What it does |
|---|---|
| **Planner** | Reads a page, lists every control it offers, and writes test cases: normal use with realistic values, edge inputs, state changes, keyboard. It cannot act on the page. |
| **Testers** | Each plays a group of cases in a browser of its own. A tester says what it expects *before* it acts, and the engine checks it: the exact items of a list, what a field holds, a message that is or is not there. |
| **The engine** | Detects server errors, exceptions, dead buttons and accessibility failures by itself, replays every reported bug three times in a fresh browser before it reaches the report, and counts what was and was not tested. |

> ⚠️ `--hostile` sends real XSS/SQLi payloads. Only point it at apps you own or
> have explicit permission to test — never a third party's production site.

---

## 🔧 How it works

```
/haunt-test                     your command
    │
    ├── scouting                reads real links from your app's DOM
    │                           maps up to 4 areas to test
    │
    ├── testing                 one tester per area, one browser each,
    │   ├── 👻 /signup          all parallel: see the whole area,
    │   ├── 👻 /dashboard       plan its test cases, then
    │   └── 👻 /pricing         expect → act → check
    │
    ├── sweep                   the engine presses the buttons no
    │                           tester pressed, and reports what breaks
    │
    └── report                  confirmed issues ranked by impact,
                                what was tested and what was not,
                                "For Claude" section to fix it all
```

A real browser, a snapshot of every element a user could act on, and real clicks and keystrokes on them. A screenshot is taken when something has to be looked at, not at every step.

**Sessions are sandboxed to your app's own origins.** On the first visit haunt records every origin your app loads from (your dev server, your CDN, your API host) and freezes that list. Anything the session requests afterwards from a *genuinely new* origin — including a cross-origin redirect — is blocked and listed under "blocked requests" in the report. That's a sandbox block, not an app bug. If your app only calls a second API origin or port after a user interaction, make sure it's also reached during the initial page load, or that call will show up as blocked. Sessions are also capped at ~15 minutes of active time, after which they must be ended rather than continued.

---

## 🤖 Run it in CI

`/haunt-test` needs an interactive Claude Code session. `haunt-ci` is a
standalone binary that runs the same thing without one, and exits like a test
suite: `1` if any critical or major issue was found, `0` otherwise, `2` if it
could not run.

```bash
npx --package @haunt/mcp-server haunt-ci https://staging.example.com \
  --spec docs/requirements.md
```

**With Claude Code installed (the default).** `haunt-ci` hands the real
`/haunt-test` command to a headless Claude Code session, on the account that
machine is logged into. No API key, the same route discovery and login as the
interactive command, and only haunt's own tools are allowed in that session.
On a CI runner, install Claude Code and give it a token created with
`claude setup-token`. Runs count against that account's usage.

```yaml
# .github/workflows/haunt.yml
- run: npx --package @haunt/mcp-server haunt-ci ${{ env.STAGING_URL }}
  env:
    CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

**With an API key instead.** Without Claude Code, or with `--provider
anthropic|mistral`, `haunt-ci` runs its own smaller loop and calls the API
directly. Set `ANTHROPIC_API_KEY` or `MISTRAL_API_KEY` (a `.env` file in the
working directory is loaded automatically; it is gitignored, never commit
it). Default models: `claude-opus-5` for Anthropic, `mistral-small-latest`
for Mistral — override with `--model` or `HAUNT_CI_MODEL`. This mode tests
exactly the URL you give it, without route discovery, and its results depend
heavily on the model: a small one finds little. `--verbose` prints each
action the model decided and what it did.

---

## 📄 License

MIT — fork it, extend it, run it in CI.

If Haunt finds something real in your app, we'd love to hear what it caught.

---

<div align="center">
<i>Built for the era where shipping fast is the default.<br>Haunt is what you run right before you do.</i>
</div>
