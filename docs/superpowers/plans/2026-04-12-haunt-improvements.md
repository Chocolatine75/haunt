# Haunt Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features to the Haunt command that close the daily-use loop: auth debugging, cost estimation before launch, and an actionable report format that Claude can act on directly.

**Architecture:** All changes are to `commands/haunt-test.md` — the single markdown file that defines the `/haunt-test` command behavior. No new files are created. Each feature adds or modifies a phase in the existing Phase 0.5 → 1 → 2 → 3 flow.

**Tech Stack:** Markdown (Claude Code command file), plain text output

---

## File Structure

```
commands/
└── haunt-test.md    # Only file modified — three targeted additions
```

---

## Task 1: `--debug-auth` flag in Phase 0.5

**Files:**
- Modify: `commands/haunt-test.md` — Phase 0.5 section

Currently Phase 0.5 prints a single line `logging in as <email>...` and then `authenticated — cookies captured`. With `--debug-auth`, each step prints its own status line so failures are pinpointable.

- [ ] **Step 1: Read the current Phase 0.5 section**

Read `commands/haunt-test.md` lines 40–58 to confirm the current auth phase text before editing.

- [ ] **Step 2: Add `--debug-auth` to the Arguments section**

In the `## Arguments` section (around line 9), add after the `--password` entry:

```markdown
- `--debug-auth` — Print each auth step verbosely (use when auth fails silently)
```

- [ ] **Step 3: Add debug-auth behavior to Phase 0.5**

Replace the Phase 0.5 section with:

````markdown
### Phase 0.5 — Auth (only if --email and --password are provided)

If credentials are present:

Print: `logging in as <email>...`

1. `haunt_spawn` at `target_url` with timeout: 5
   - If `--debug-auth`: print `  · browser opened`
2. `haunt_capture_state` (`include_dom: true`) — look for a login form or link
   - If `--debug-auth`: print `  · page loaded`
3. If not already on a login page, `haunt_navigate` to find and go to the login page (look for a "Login", "Sign in", or "Se connecter" link in the accessibility tree or DOM)
   - If `--debug-auth`: print `  · login form found at <url>`
4. `haunt_navigate` — fill `<email>` in the email field
   - If `--debug-auth`: print `  · email filled`
5. `haunt_navigate` — fill `<password>` in the password field
   - If `--debug-auth`: print `  · password filled`
6. `haunt_navigate` — click the submit/login button
   - If `--debug-auth`: print `  · submit clicked`
7. `haunt_capture_state` — verify auth succeeded: URL is no longer the login page, or a logged-in element (avatar, dashboard, username) is visible
   - If `--debug-auth`: print `  · checking session...`
8. `haunt_get_cookies` — extract the session cookies
   - If `--debug-auth`: print `  · cookies captured (<N>)`
9. `haunt_end_session`

Print: `authenticated  —  cookies captured`

Store the cookies. Pass them to every `haunt_spawn` call in Phase 2 via the `cookies` parameter.

If login fails (still on login page after submit, or error visible): print `login failed — check your credentials` and stop.
````

- [ ] **Step 4: Verify the edit looks right**

Read `commands/haunt-test.md` Phase 0.5 section and confirm the `--debug-auth` conditionals are present and correctly indented.

- [ ] **Step 5: Commit**

```bash
git add commands/haunt-test.md
git commit -m "feat(haunt): --debug-auth flag for verbose auth step logging"
```

---

## Task 2: Cost estimate phase (Phase 1.5)

**Files:**
- Modify: `commands/haunt-test.md` — between Phase 1 and Phase 2

After Phase 1 (recon), Haunt knows exactly how many routes it will test and how many steps per route. Insert a cost estimate + confirmation prompt before spawning browsers.

- [ ] **Step 1: Add `--yes` to the Arguments section**

In the `## Arguments` section, add after `--debug-auth`:

```markdown
- `--yes` — Skip the cost estimate confirmation prompt (for scripted use)
```

- [ ] **Step 2: Insert Phase 1.5 between Phase 1 and Phase 2**

After the Phase 1 block (after the `Print the discovered routes` line), insert:

````markdown
### Phase 1.5 — Cost estimate

Compute:
- `route_count` = number of areas in the page plan (max 4)
- `steps_per_route` = value of `--steps` (default: 3)
- `browser_calls` = route_count × (steps_per_route × 2 + 3)
  - (spawn + capture_state + [navigate + capture_state] × steps + end_session)
- `session_size` = "light" if browser_calls ≤ 6, "medium" if ≤ 16, "heavy" if > 16

Print exactly:

```
estimated: N routes · M steps each · ~K browser calls · [light|medium|heavy] session
proceed? [y/N]
```

- If `--yes` flag is present: skip the prompt and continue directly to Phase 2.
- Otherwise: wait for user input.
  - If user types `y` or `yes`: continue to Phase 2.
  - Any other input (including Enter alone): print `aborted.` and stop.
````

- [ ] **Step 3: Verify Phase 1.5 is positioned correctly**

Read `commands/haunt-test.md` and confirm Phase 1.5 appears between Phase 1 and Phase 2.

- [ ] **Step 4: Commit**

```bash
git add commands/haunt-test.md
git commit -m "feat(haunt): cost estimate + confirmation prompt before spawning browsers"
```

---

## Task 3: Actionable report format for the Claude fix loop

**Files:**
- Modify: `commands/haunt-test.md` — Phase 3 report format

Two additions to Phase 3:
1. Each issue gets `affected_file` (AI heuristic based on path convention) and `suggested_fix` (concrete action, not symptom description)
2. A `## For Claude` section at the end of every report — a copy-pasteable fix list

- [ ] **Step 1: Update the issue format in Phase 3**

Find the issue template in Phase 3 (the `### N. [CRITICAL]` block) and replace with:

````markdown
### 1. [CRITICAL] <description>
- **Page:** `<page_url>`
- **Fix:** <concrete one-sentence recommendation — what to add or change, not just what is wrong>
- **Likely file:** `<file path based on Next.js App Router convention: e.g. /signup → app/signup/page.tsx, /api/foo → app/api/foo/route.ts>` *(AI estimate — verify before editing)*
````

Apply the same `**Likely file:**` line to MAJOR and MINOR issue templates.

**File path heuristic rules to apply:**
- `/foo` → `app/foo/page.tsx`
- `/foo/bar` → `app/foo/bar/page.tsx`
- `/api/foo` → `app/api/foo/route.ts`
- Auth issues → `lib/auth.ts` or `middleware.ts`
- Form validation issues → the page file for that route
- If the framework is unclear, omit the field rather than guess wrong

- [ ] **Step 2: Add the `## For Claude` section to the report template**

At the end of the report template (after `## Top Fix`), add:

````markdown
## For Claude

The following issues were found by Haunt. Fix them in order of severity.

<For each issue, one line:>
N. [SEVERITY] `<page_url>` — <one-sentence fix instruction>. Likely in `<file>`.

After fixing, run `/haunt:haunt-test <target_url>` again to verify.
````

**Formatting rules for the For Claude list:**
- One line per issue, numbered sequentially, critical first
- The fix instruction must be actionable: "Add `required` attribute to email input and show inline error on empty submit" not "Fix the validation"
- Include the likely file on every line
- End with the re-run command using the actual target URL from the session

- [ ] **Step 3: Verify the updated Phase 3 template**

Read `commands/haunt-test.md` Phase 3 and confirm:
- Each issue block has `**Likely file:**`
- `## For Claude` section exists with the correct format
- The re-run instruction uses the actual `target_url` variable, not a hardcoded URL

- [ ] **Step 4: Commit**

```bash
git add commands/haunt-test.md
git commit -m "feat(haunt): actionable report — affected_file heuristic + For Claude fix list"
```

---

## Task 4: End-to-end validation

Run Haunt against haunt-target with all three new features and verify they work correctly.

**Prerequisite:** haunt-target is running at http://localhost:3000 (see haunt-target plan Task 12).

- [ ] **Step 1: Test --debug-auth**

```
/haunt:haunt-test http://localhost:3000 --email test@example.com --password password123 --debug-auth
```

Expected output includes verbose step lines:
```
logging in as test@example.com...
  · browser opened
  · page loaded
  · login form found at /login
  · email filled
  · password filled
  · submit clicked
  · checking session...
  · cookies captured (2)
authenticated  —  cookies captured
```

- [ ] **Step 2: Test cost estimate prompt**

```
/haunt:haunt-test http://localhost:3000
```

Expected: after `routes: / /signup /login /dashboard ...`, Haunt prints:
```
estimated: 4 routes · 3 steps each · ~36 browser calls · heavy session
proceed? [y/N]
```
Type `n` — expected: `aborted.`

Run again, type `y` — expected: proceeds to Phase 2.

- [ ] **Step 3: Test --yes skips the prompt**

```
/haunt:haunt-test http://localhost:3000 --yes
```

Expected: no prompt, goes directly to `testing 4 areas...`

- [ ] **Step 4: Verify the For Claude section in the report**

Open `.haunt-reports/<latest>.md` and confirm:
- Each issue has a `**Likely file:**` line
- `## For Claude` section exists at the end
- Fix instructions are concrete (not just symptom descriptions)
- Re-run command uses `http://localhost:3000`

- [ ] **Step 5: Commit**

```bash
git add .haunt-reports/
git commit -m "test(haunt): validation report from haunt-target — all three improvements confirmed"
```
