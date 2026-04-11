<img width="1024" height="254" alt="image" src="https://github.com/user-attachments/assets/4850ae4a-af1f-44a5-9ce8-1ca062553939" />

---

AI writes your code in minutes. You ship it in hours.

And somewhere in that speed, you skipped something. A route that loads without auth. An API that returns everyone's data to anyone who asks. A form that crashes when someone types the wrong thing.

You didn't catch it because **you tested it like a developer** — you knew where to click, what to fill in, what not to break. Your users don't have that context. They'll find every edge case you never imagined.

**Haunt finds them first.**

---

## What just happened on a real project

We ran Haunt against a recruitment app. One command. Under 4 minutes.

```
/haunt:haunt-test http://localhost:3000 --personas malicious-user
```

It found this:

```
[!!!] CRITICAL — Unauthenticated GET /api/hrflow/profiles returns 10,000 candidate
      profiles with full PII: names, emails, phones, dates of birth, GPS coordinates,
      profile pictures, and complete CV text. Zero authentication required.
      Trivially scrapable by any anonymous visitor.

[!!!] CRITICAL — /dashboard loads for any anonymous user. No auth redirect.

 [!!] MAJOR — GET /api/account/searches accepts user_id as a query param with no
      session check. Any visitor can read any user's search history by incrementing IDs.
```

This wasn't a legacy codebase. It was built with AI assistance, tested by the developer, and about to be demoed. **10,000 people's personal data was one curl command away from being scraped.**

Haunt caught it before deployment.

---

## The problem it solves

Vibe coding changed the pace of software. Features that took days now take hours. That's incredible — and it creates a new class of bugs.

When you move fast with AI, you build the happy path perfectly. The AI follows your intent. You test what you intended. Everything works.

But your users don't follow your intent. They:

- Submit forms with no data, wrong data, malicious data
- Navigate directly to URLs they shouldn't reach
- Increment IDs in query params and see other people's data
- Refresh mid-flow, double-click submit, go back after checkout
- Use keyboard only and get trapped in a modal forever

These aren't rare edge cases. They're the first things real users do. And they're the last things a developer thinks to test.

---

## What Haunt does

One command. Before you deploy.

```bash
/haunt:haunt-test http://localhost:3000
```

Haunt spawns phantom users against your running localhost. Not bots. Not scripts. AI agents that **behave like real users who don't know your app** — each with a specific flavor of chaos:

**The Confused Beginner** submits your signup form empty. Types a phone number in the email field. Hits the back button after payment. Clicks the same button twice. Modifies the URL and navigates somewhere you never meant to be a route.

**The Malicious User** puts `<script>alert(1)</script>` in every text input. Navigates to `/admin`, `/api/users`, `/dashboard` without logging in. Increments every ID in every URL. Adds `?admin=true` to query strings. Looks for stack traces in error messages.

**The Screen Reader User** tabs through every element on the page. Tries to close modals with Escape. Submits forms and checks whether errors are announced. Finds every button with no label and every input with no accessible name.

They run in parallel. They report issues by severity. They hand you a structured report with concrete fixes.

The whole thing runs in minutes and costs nothing.

---

## Install

```
/plugin marketplace add Chocolatine75/haunt
/plugin install haunt
/reload-plugins
```

No API key. No config file. No infrastructure. Chromium downloads itself on first run.

> **Requires:** Claude Code · Node.js 18+

---

## Usage

```bash
# Default run — confused beginner tears through your UI
/haunt:haunt-test http://localhost:3000

# Security pass — finds auth bypasses, PII leaks, injection vectors
/haunt:haunt-test http://localhost:3000 --personas malicious-user

# Accessibility audit — keyboard-only, finds every ARIA failure
/haunt:haunt-test http://localhost:3000 --personas screen-reader-user

# Full sweep — all three personas at once
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user

# Test authenticated flows — Haunt logs in first, then tests everything behind auth
/haunt:haunt-test http://localhost:3000 --email you@example.com --password yourpass

# Watch it happen live
/haunt:haunt-test http://localhost:3000 --headed
```

Reports saved to `.haunt-reports/` — structured markdown with YAML frontmatter, ready for humans and agents.

---

## Built-in personas

| | Persona | Behavior | Catches |
|---|---|---|---|
| 🟢 | `confused-beginner` | Wrong inputs, empty forms, URL hacking, back-button chaos | Validation gaps, silent failures, broken error states |
| 🔴 | `malicious-user` | XSS, SQLi, direct URL access, IDOR enumeration, param injection | Auth bypasses, PII exposure, server errors, data leaks |
| ♿ | `screen-reader-user` | Keyboard-only navigation, modal edge cases, ARIA probing | Focus traps, unlabeled elements, inaccessible errors |

---

## Custom personas

Your app is unique. Your failure modes are too.

```yaml
name: Impatient Power User
description: Moves fast, skips steps, expects things to just work
system_prompt: |
  You move fast and skip everything optional.
  Double-click buttons. Refresh mid-flow. Skip required fields and submit anyway.
  If something needs more than 2 steps, try to skip one.
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

## Open source

MIT. Fork it, extend it, add personas, break things.

If Haunt finds a real bug in your app — open an issue and tell us what it caught. We're collecting war stories.

---

*Built for the era where shipping fast is the default. Haunt is what you run right before you do.*
