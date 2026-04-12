# Haunt — Daily Usability Design

**Date:** 2026-04-12
**Goal:** Make Haunt useful, functional, and easy enough to be used daily as part of a vibecode → test → fix loop.

---

## Context

Haunt is a Claude Code plugin that simulates phantom users testing web apps for corner cases. The MVP is complete. The problem is it has never been validated on a real large project — specifically, the auth feature has never been tested end-to-end, and the token cost on complex apps is unknown. The target user builds SaaS apps with Next.js and uses Haunt after finishing a feature, then feeds the report to Claude to fix issues.

---

## Part 1 — Demo SaaS Target App (`haunt-target`)

A realistic Next.js SaaS app that serves as the official test target for Haunt. Lives at `haunt-target/` in the haunt repo root. Fast to spin up, zero external dependencies, with intentional realistic bugs that Haunt should find.

### Stack

- **Next.js 14** (App Router)
- **NextAuth** (credentials provider)
- **Prisma + SQLite** (no external DB needed)

### Routes

| Route | Description | Auth required |
|---|---|---|
| `/` | Landing page with signup CTA | No |
| `/signup` | Registration form | No |
| `/login` | Login form | No |
| `/dashboard` | Main app area | Yes |
| `/settings` | Account settings | Yes |
| `/admin` | Admin panel | Yes (admin role) |

### Intentional Bugs

These bugs mimic what a real vibecodeed project would produce:

| Bug | Type | Page |
|---|---|---|
| Signup accepts empty email with no error | UX | `/signup` |
| `/dashboard` loads for unauthenticated users (missing redirect) | Auth | `/dashboard` |
| `/admin` only checks role client-side (bypassable) | Auth | `/admin` |
| Double-submit on login creates duplicate session | UX | `/login` |
| Settings save shows no feedback (no success/error state) | UX | `/settings` |
| Password logged in `console.log` left from dev | Auth | `/login` |

### Setup

```bash
cd haunt-target
npm install
npx prisma db push
npm run dev
# → http://localhost:3000
# default user: test@example.com / password123
```

---

## Part 2 — Haunt Improvements

Three targeted additions that directly unblock the daily use case.

### 2.1 Auth Debug Flag (`--debug-auth`)

When `--email` and `--password` are passed, adding `--debug-auth` prints each auth step verbosely:

```
logging in as test@example.com...
  ✓ page loaded
  ✓ login form found at /login
  ✓ email filled
  ✓ password filled
  ✓ submit clicked
  ✓ session confirmed — redirected to /dashboard
  ✓ cookies captured (2)
authenticated
```

Without `--debug-auth`, existing behavior is unchanged (single `authenticated — cookies captured` line).

**Why:** The auth feature has never been tested on a real app. This flag makes it observable without adding noise to the normal flow.

### 2.2 Cost Estimate Before Launch

Before spawning any browser, Haunt prints an estimate and asks for confirmation:

```
estimated: 4 routes · 3 steps each · ~12 browser calls · medium session
proceed? [y/N]
```

- Routes count comes from Phase 1 recon
- Steps from `--steps` value
- Session size is: ≤6 calls = light, ≤16 = medium, >16 = heavy
- Default answer is N — user must type `y` to proceed

Skip confirmation if `--yes` flag is passed (for CI or scripted use).

**Why:** Token anxiety is a real blocker on large apps. One confirmation prompt removes the fear.

### 2.3 Report Improvements for the Claude Fix Loop

The current report describes symptoms. The improved report adds actionability for the downstream Claude session.

**New fields per issue:**

```markdown
### 1. [CRITICAL] Signup accepts empty email with no visible error
- **Page:** `/signup`
- **Fix:** Add client-side validation before submit — check email field is non-empty and matches email format, show inline error message
- **Likely file:** `app/signup/page.tsx` *(AI estimate based on Next.js App Router conventions — not guaranteed)*
```

**New section at end of report — `## For Claude`:**

```markdown
## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [CRITICAL] `/signup` — Add email validation. Likely in `app/signup/page.tsx`.
2. [MAJOR] `/dashboard` — Add auth redirect for unauthenticated users. Check middleware or page-level auth guard.
3. [MAJOR] `/admin` — Move role check server-side. Client-only role checks are bypassable.

Run `/haunt-test http://localhost:3000` again after fixes to verify.
```

**Why:** The report is the bridge between Haunt and Claude. Vague symptoms force Claude to guess. Concrete file hints and a copy-pasteable fix list close the loop.

---

## The Daily Loop (After This Work)

```
vibecode feature
    ↓
/haunt-test http://localhost:3000 --email test@example.com --password password123
    ↓
estimated: 4 routes · ~12 calls · medium — proceed? y
    ↓
report: .haunt-reports/2026-04-12-confused-beginner.md
    ↓
paste "For Claude" section → Claude fixes issues
    ↓
repeat
```

---

## Out of Scope

- CI/CD integration (future milestone)
- Multiple simultaneous personas on large apps (future)
- Visual diff / screenshot comparison (future)
