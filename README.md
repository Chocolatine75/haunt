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
haunt v0.1.0  —  phantom user testing

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

report: .haunt-reports/2026-04-20-confused-beginner.md
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
# Default — a confused first-time user explores your app
/haunt:haunt-test http://localhost:3000

# Watch it happen in real time
/haunt:haunt-test http://localhost:3000 --headed

# Adversarial — probes every input and URL
/haunt:haunt-test http://localhost:3000 --personas malicious-user

# Accessibility — keyboard-only, finds every broken interaction
/haunt:haunt-test http://localhost:3000 --personas screen-reader-user

# Full sweep — all three personas at once
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user

# Test authenticated areas — Haunt logs in first, then explores
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret
```

Reports saved to `.haunt-reports/` — structured markdown with YAML frontmatter.

Full flag reference: [docs/cli.md](docs/cli.md)

---

## 👻 The personas

Each phantom user has a different way of going off-script.

| Persona | Who they are | What they do |
|---|---|---|
| 😕 `confused-beginner` | First-time user with no context | Submits forms empty, enters wrong data types, modifies URLs, hits back after submit, ignores instructions |
| 😈 `malicious-user` | User who pushes on everything | Tries unexpected inputs in every field, accesses URLs directly, probes what's reachable without logging in |
| ♿ `screen-reader-user` | Keyboard-only user | Tabs through every element, triggers modal edge cases, checks if errors are announced, finds unlabeled buttons |

---

## ✍️ Custom personas

Your app has specific failure modes. Write the user who finds them.

```yaml
name: Impatient Power User
description: Moves fast, skips steps, expects things to just work
system_prompt: |
  You move fast and skip everything that looks optional.
  Double-click buttons. Refresh mid-flow. Skip required fields and submit anyway.
  If something needs more than 2 steps, try to skip one.
  Report anything that breaks when you don't follow the expected sequence.
browser:
  headless: true
  viewport: { width: 1440, height: 900 }
scenarios:
  - name: Speed run
    goal: Break the experience by going too fast
    max_steps: 10
```

```bash
/haunt:haunt-test http://localhost:3000 --personas ./personas/power-user.yaml
```

---

## 🔧 How it works

```
/haunt-test                     your command
    │
    ├── scouting                reads real links from your app's DOM
    │                           maps up to 4 areas to test
    │
    ├── spawns N phantoms       one browser per area, all parallel
    │   ├── 👻 /signup          confused beginner tries to register
    │   ├── 👻 /dashboard       tries the main app without context
    │   ├── 👻 /pricing         looks at plans, looks for a CTA
    │   └── 👻 /editor          lands directly, no onboarding
    │
    └── report                  issues ranked by impact
                                "For Claude" section auto-fixes everything
```

No AI vision. No magic. Just a real browser reading your accessibility tree — and an AI deciding what a confused user would do next.

---

## 🤖 Run it in CI

`/haunt-test` needs an interactive Claude Code session — it's not something a pipeline
can invoke. `haunt-ci` is a standalone binary that runs the same phantom-user loop
without one, calling an LLM API directly for the per-step reasoning. Anthropic and
Mistral both work — pick whichever key you have, `haunt-ci` auto-detects which one is
set (`--provider` forces it explicitly if both are):

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # or: export MISTRAL_API_KEY=...
npx --package @haunt/mcp-server haunt-ci https://staging.example.com \
  --personas confused-beginner,malicious-user \
  --steps 3
```

A `.env` file in the working directory (`mcp-server/.env` in this repo) is loaded
automatically — put `ANTHROPIC_API_KEY=` or `MISTRAL_API_KEY=` there instead of
exporting it. It's gitignored; never commit it.

Exits `1` if any critical or major issue was found (`0` otherwise), so it fails a
build the way a test suite does:

```yaml
# .github/workflows/haunt.yml
- run: npx --package @haunt/mcp-server haunt-ci ${{ env.STAGING_URL }}
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Default models: `claude-opus-5` for Anthropic, `mistral-small-latest` for Mistral —
override either with `--model` or `HAUNT_CI_MODEL`.

Scope, honestly stated: `haunt-ci` tests exactly the URL you give it, across the
personas you name, run in parallel — it does not do `/haunt-test`'s Phase 1 route
discovery (scouting up to 4 areas from real links on the page). Point it at each route
you care about explicitly. Unlike the interactive command, this mode needs its own
API key and spends real tokens per run — a cost the interactive command, riding your
existing Claude Code session, doesn't have.

---

## 📄 License

MIT — fork it, extend it, add personas, run it in CI.

If Haunt finds something real in your app, we'd love to hear what it caught.

---

<div align="center">
<i>Built for the era where shipping fast is the default.<br>Haunt is what you run right before you do.</i>
</div>
