# Haunt v3 — roadmap and acceptance gates

## Goal

Be the best tool for QA-testing a web app the way a real user would, and
measurably better at it than browser-use. What minitap is for mobile apps,
haunt should be for web apps: the agent you point at an app to find out what
is broken, with results you can trust.

"Better" is a number, not a claim. It is decided by the head-to-head benchmark
in part 7, and each part before it exists to move that number.

Where things stand and why is in [`HISTORY.md`](HISTORY.md). The ideas below
come from a survey of browser-use, Playwright MCP, agent-browser, Chrome
DevTools MCP, Stagehand, Passmark, Expect and Anthropic's computer use
guidance (October 2026).

## The rule: a part is accepted only when its gate passes

Every part below has a **gate**: a set of deliberately hard tests. The part is
not done, and is not merged as done, until every test in its gate passes.

1. **The gate is written first.** Its tests land before or with the first
   implementation PR, and they must fail for the right reason before the
   implementation exists.
2. **The gate is hard on purpose.** It targets the cases where browser agents
   actually break (shadow DOM, overlays, timing, flakiness), not the cases
   that are easy to pass. A gate that passes on the first try was too easy;
   add cases.
3. **A gate is never weakened to get a part through.** A gate test may only be
   changed when it is itself wrong, in its own PR, with the reason written
   down. Skipping, loosening an assertion or raising a timeout to go green
   counts as weakening.
4. **Green means green in CI**, on Linux and macOS, with no retries.
   Pull requests run macOS only; the three systems run on `v2` once the
   part is merged, and the part is accepted when that run is green on Linux
   and macOS. Windows runs but does not block: its runners are slow enough
   that page timings cross their thresholds at random.
   A gate test that passes only sometimes is failing. Time budgets are the
   exception for now: they are enforced by `npm run check` on a developer's
   machine and only reported in CI, because shared runners are too uneven to
   measure against. Making them relative to a baseline measured in the same
   run is the open way to enforce them in CI again.
5. **Earlier gates stay green.** A part that breaks a previous gate is not
   accepted.
6. **Gates that need a real LLM** (marked *live*) cannot run in CI. They are
   run by hand, three times, and the scorecards are committed under
   `docs/benchmarks/`. The acceptance threshold applies to the worst of the
   three runs.

Gate tests live in `mcp-server/src/gates/`, one file per part, and run against
the gauntlet app.

## The gauntlet

A purpose-built web app in `mcp-server/src/test-support/gauntlet/`, served by
the tests themselves, with no framework and no network access. It contains
the hard cases every gate draws on, and a registry of every bug planted in it
(`gauntlet/ground-truth.json`) with, for each one, its page, its kind and the
deterministic way to trigger it.

It also has a **clean** variant of every page with the bugs removed. A tool
that reports issues on the clean variant is producing false positives, and
every gate checks that too.

`demo/` stays as the realistic Next.js target for live runs.

## Parts

### 1. Element references and a full action set

Replace the regex action grammar (`click Sign up`) with numbered references to
real elements, and add the actions a user actually has.

Full specification and gate: [`v3/part-1-actions.md`](v3/part-1-actions.md).
The summary below is superseded by it where they differ.

Scope: references in the snapshot (`e12`) resolved without guessing; `click`,
`fill`, `select`, `check`, `hover`, `press`, `scroll`, `drag`, `upload`,
`back`, `wait_for`, tab switching, dialog handling; fast and explicit failure
when a reference is stale.

**Gate** (deterministic, scripted actions, no LLM):

- Completes a scripted flow on each of: open and closed shadow DOM, nested
  and cross-origin iframes, a custom (non-`<select>`) dropdown, a native
  `<select>`, a date picker, a `contenteditable` editor, a file upload, a
  drag-and-drop list reorder, a hover-only menu, an infinite-scroll list
  reaching item 200, a link that opens a new tab, `alert`/`confirm`/`prompt`
  dialogs, and five identically named buttons where the third must be clicked.
- Types values containing ` in `, quotes, newlines, emoji and a 5,000-character
  string, and reads back exactly what was typed.
- A reference to an element removed or re-rendered since the snapshot fails
  with a "stale reference" error, never by acting on a different element.
- An action on a missing or covered element fails in under 2 seconds and says
  why (not found, covered by which element, disabled, off-screen).
- 50 sequential actions on a page with 2,000 interactive elements complete in
  under 30 seconds.

### 2. Deterministic signals

Detect what can be detected without asking a model, so those findings are
never hallucinated and never missed.

Full specification and gate: [`v3/part-2-signals.md`](v3/part-2-signals.md).
The summary below is superseded by it where they differ.

Scope: HTTP 4xx/5xx on any request; uncaught exceptions and unhandled
rejections with stack traces; requests that never settle; accessibility
violations via axe-core; slow responses and long tasks; errors raised after
the last action (lost today).

**Gate** (deterministic, no LLM):

- On the gauntlet's signal pages, reports every planted signal with the right
  kind, URL and step, and nothing else: a 500 from a `fetch`, a 404 asset, an
  uncaught exception thrown 800 ms after a click, an unhandled promise
  rejection, a request that never resolves, each of 12 planted axe violations
  by rule id, a 4-second response, a 600 ms main-thread block.
- On the clean variants of the same pages: zero findings.
- A signal raised after the final action is present in the session's results.
- Each finding is attributed to the action that caused it, including when two
  actions are 50 ms apart.
- A sandbox block is never reported as a signal.

### 3. Evidence and verification

Nothing reaches a report on a model's word alone.

Scope: an evidence bundle per issue (screenshot, the steps that led to it, a
Playwright trace, the triggering signal); replay of those steps in a fresh
session before the issue is reported; a confidence level; flaky findings
separated from confirmed ones.

**Gate** (deterministic, no LLM):

- Every issue in a report has a bundle whose steps, replayed by the test in a
  new session with no other input, reproduce the same signal.
- A planted bug that fires on 1 run in 5 is reported as flaky with its
  observed rate, not as confirmed and not dropped.
- An injected finding with no reproducing steps is rejected, not reported.
- No password, email or cookie value used in the session appears anywhere in
  the bundle: not in the trace archive, the screenshots' text, the HAR, the
  report or the logs. The test searches all of them.
- Bundle storage is capped; a 200-step session stays under the cap.

### 4. A tester, not a persona

Test a page the way a QA engineer does, instead of playing a character on
it. Specified in [`v3/part-4-tester.md`](v3/part-4-tester.md), from a pilot
on a published benchmark where haunt found none of four annotated bugs and
plain Claude with a browser found one
([`benchmarks/2026-10-05-cattest-pilot.md`](benchmarks/2026-10-05-cattest-pilot.md)).

Scope: an inventory of what a page offers and a plan of test cases, both
kept by the engine; coverage counted in code; a budget of actions in place
of three steps; an expectation stated before each action and checked after
it, with exact readings of lists and values; issues the engine cannot check
listed for a person instead of dropped; a screenshot on request; no persona
by default; an optional description of the app.

**Gate**: T1 to T6 of the specification, deterministic, on six new gauntlet
pages whose defects raise no signal; and, *live*, at least as many annotated
bugs found on the pilot's three applications as Claude Code with Playwright
MCP, for no more than the same cost.

### 5. Bounded, visual perception

Show the tester what a user would see, and catch bugs that only exist
visually.

Scope: a snapshot limited to what is in the viewport and not covered by
another element; a compact, diff-based snapshot format; annotated screenshots
whose labels are the element references; visual checks; computer use as the
perception and action path in `haunt-ci`.

**Gate**:

- Deterministic: with a modal open, no element behind it appears as
  actionable; an element below the fold is absent until scrolled to; the
  snapshot of the 2,000-element page fits a fixed token budget; every label
  drawn on an annotated screenshot resolves to the element under it at
  viewport sizes 375, 768 and 1440.
- Deterministic: visual checks flag each planted visual bug and nothing on the
  clean variants: text overflowing its container, two overlapping buttons,
  white text on white, a control pushed off-screen at 375 px, a transparent
  overlay swallowing clicks, a layout shift after load.
- *Live*: driven only by screenshots, the tester completes the part 1 flows
  on at least 12 of the 15 gauntlet pages.

### 6. From finding to regression test

Make a found bug stay fixed, and test what changed.

Scope: pick routes to test from a git diff; turn a confirmed issue into a
Playwright test file; replay known flows without model calls.

**Gate** (deterministic, no LLM):

- For each of 10 gauntlet bugs, the generated test fails against the buggy
  variant and passes against the clean one, with no edits, 10 runs in a row.
- Given a diff touching 3 known routes among 40, the selected targets are
  exactly those 3 plus the routes that link to them.
- A recorded flow replays with zero model calls; when the page's markup
  changes but its behaviour does not, replay still passes.

### 7. Head-to-head benchmark

The measure of the goal.

Scope: a ground-truth set of at least 30 runtime-only bugs across the gauntlet
and `demo/` (timing races, overlays, hanging requests, state bugs after
back/refresh, double submits, bugs that need authentication, bugs at mobile
width), plus the clean variants; a runner that executes haunt and browser-use
(through its own QA entry point, vibetest-use, and through its agent with an
equivalent QA prompt) on the same targets, with the same model, the same step
budget and the same wall-clock budget.

**Gate** (*live*, three runs each, worst run counts):

- Haunt's recall on the ground-truth set is at least 80%, and higher than
  browser-use's.
- Haunt's precision is at least 90%, and higher than browser-use's. Any issue
  reported on a clean variant counts against it.
- Every haunt finding counted as correct has a replayable evidence bundle.
- Cost and time per run are reported next to the scores. Haunt may cost more;
  it may not cost more than twice as much for the same budget.
- The runner, the ground truth, the prompts given to each tool and the raw
  outputs are all committed, so the comparison can be rerun by anyone.

Until this gate passes, nothing in the README or elsewhere says haunt is
better than browser-use.

## Order

1 → 2 → 3 → 4 → 5 → 6, with the part 7 runner and ground truth started alongside
part 1 so that every later part can be measured as it lands. Parts 2 and 3
are where haunt can pull ahead: the other tools are strong at acting on a
page and weak at proving that what they report is real.

Each part gets its own design note in `docs/` before implementation, and is
split into PRs small enough to review.
