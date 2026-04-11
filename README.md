<img width="1024" height="254" alt="Haunt" src="https://github.com/user-attachments/assets/4850ae4a-af1f-44a5-9ce8-1ca062553939" />

<div align="center">

**AI phantom users that test your app the way real users actually use it.**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet?style=flat-square)](https://claude.ai/code)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Install](https://img.shields.io/badge/install-one%20command-brightgreen?style=flat-square)](#install)

</div>

---

You built an experience. You know exactly how it's supposed to feel.

You click through it yourself — it's smooth, it works, it's exactly what you imagined.

Then someone else uses it.

They don't click where you clicked. They skip the step you assumed was obvious. They type something unexpected. They land on a page from a bookmark instead of the onboarding flow. And suddenly the experience you built doesn't feel like the one they're getting.

**Haunt checks whether the experience you imagined is the one your users actually get.**

---

## 🔍 A real test, on a real app

We ran Haunt on a fresh SaaS app — an AI writing tool, just before its first demo.

```
/haunt:haunt-test http://localhost:3000 --personas confused-beginner
```

```
haunt v0.1.0  —  phantom user testing

scouting...
routes: /  /signup  /editor  /dashboard  /pricing

testing 4 areas...

────────────────────────────────────────
4 areas tested · 7 issues found

[!!!] 2 critical
 [!!] 4 major
  [!] 1 minor

> Signup form submits silently with an empty email — no error message shown
> /editor loads for unauthenticated users — blank page with no redirect or explanation

fix first: add visible error feedback to the signup form — it accepts empty input
           and shows nothing, leaving users wondering if they did something wrong

report: .haunt-reports/2026-04-11-confused-beginner.md
────────────────────────────────────────
```

The signup form? Broken for anyone who didn't fill it perfectly.
The editor? Loads for users who were never supposed to reach it yet.

The developer had tested both. But they'd tested them *knowing what they were doing*.

---

## 💡 The gap Haunt closes

> **You test your app like a developer. Your users aren't developers.**

When you build something with AI assistance, you move fast. Features appear in hours. The happy path works perfectly because you designed it and you test it.

But real users veer off the path constantly:

- 📋 They paste text into the wrong field
- 🔙 They hit the back button mid-signup and try again
- ⌨️ They tab through your form in an order you never considered
- 📱 They arrive from a shared link that skips your onboarding
- 💨 They click "submit" before finishing — twice

None of these are bugs you'd catch yourself. You know your app too well.

Haunt doesn't. It comes in fresh, does unexpected things, and reports exactly where the experience breaks.

---

## 🚀 Install

```
/plugin marketplace add Chocolatine75/haunt
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

# Stress test — a user who does everything wrong, fast
/haunt:haunt-test http://localhost:3000 --personas confused-beginner

# Adversarial — a user who pokes at every input and every URL
/haunt:haunt-test http://localhost:3000 --personas malicious-user

# Accessibility — keyboard-only, finds every broken interaction
/haunt:haunt-test http://localhost:3000 --personas screen-reader-user

# Full sweep — all three at once
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user

# Test authenticated areas — Haunt logs in first, then explores
/haunt:haunt-test http://localhost:3000 --email you@example.com --password secret

# Watch it happen
/haunt:haunt-test http://localhost:3000 --headed
```

Reports saved to `.haunt-reports/` — structured markdown with YAML frontmatter.

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
    │   ├── 👻 /editor          same user, lands on editor directly
    │   ├── 👻 /dashboard       tries the main app without context
    │   └── 👻 /pricing         looks at plans, looks for a CTA
    │
    └── report                  issues ranked by impact
                                one clear "fix first" recommendation
```

No AI vision. No magic. Just a real browser reading your accessibility tree, the same way a screen reader does — and an AI deciding what a confused user would do next.

---

## 📄 License

MIT — fork it, extend it, add personas, run it in CI.

If Haunt finds something real in your app, we'd love to hear what it caught.

---

<div align="center">
<i>Built for the era where shipping fast is the default.<br>Haunt is what you run right before you do.</i>
</div>
