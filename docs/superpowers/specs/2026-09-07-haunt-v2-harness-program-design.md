# Haunt v2 — Harness Program Design

## Context

Haunt today: interactive MCP tools (`haunt_spawn`, `haunt_capture_state`,
`haunt_navigate`, `haunt_end_session`, `haunt_get_cookies`), a small set of
fixed YAML personas (confused-beginner, malicious-user, screen-reader-user),
and a headless CLI mode (`haunt-ci` / `haunt-benchmark`) where a single LLM
call per step decides the next action from a text description of the page
(URL, title, accessibility tree). Reports are generated deterministically
from a shared `Issue` schema (severity, category, description, page URL,
recommendation).

A black-box experiment run against this v1 architecture settled a question
that had been open since the project's audit phase: does haunt's dynamic,
browser-driven testing find anything a Claude Code session with only
`Read`/`Grep` access to the app's source would miss? Two rounds were run.

Round 1, against the app's original 5 planted bugs (all literally commented
`// BUG:` in source): a blind code-review agent with no browser access found
all 5, plus 8 more real bugs, in ~2 minutes, zero false positives. Haunt's
best achievable coverage across multiple targeted runs was 4/5, with false
positives on every run. Code reading won outright.

Round 2, after planting 3 bugs designed to be invisible from source (a
timing/hydration race, a CSS overlay intercepting clicks, an unresolved
promise causing a request to hang): the blind code reviewer found 2 of 3 —
it missed only the pure timing race, the one bug with no incorrect line of
code anywhere, only a runtime interaction between hydration and click
timing. Haunt found 3 of 3 across three targeted runs.

**Conclusion: haunt's real, defensible value is narrow and specific — bugs
that exist only as runtime/behavioral artifacts, not as static logic flaws
a careful reader could trace.** Everything else this program builds exists
to make haunt actually good at that narrow thing, honestly and rigorously,
rather than paper over it with a bigger persona-prompt.

## What's wrong with the current design, specifically

Five concrete problems, each becoming one sub-project below:

1. **The persona is not an honest human simulation.** It receives the full
   accessibility tree as text — complete, structured knowledge of every
   element on the page. A real human scans, misses things below the fold,
   misreads labels, and brings priors from other apps. An agent with
   omniscient DOM access cannot authentically fail to notice a bug the way
   a real confused user would, which undermines the entire "fake user"
   premise at its foundation.

2. **UX judgments are unverified vibes.** "This seems confusing" is a
   freeform LLM claim with no falsifiable structure and no evidence
   requirement. We already know LLM judges hallucinate — the benchmark's
   own judge needed reconciliation logic after it invented ground-truth
   IDs that didn't exist. A "confusion" signal with the same lack of rigor
   is noise wearing a UX label.

3. **The loop is a fixed shallow scan, not an investigation.** Today's
   `runPersonaSession` runs exactly N fixed steps and stops, with no memory
   of what looked suspicious and no ability to double back and narrow in.
   A real QA engineer who notices something odd tests around it — tries
   boundary values, repeats the action, varies the input — until they can
   describe the failure precisely. Haunt today cannot do this at all.

4. **More model autonomy without real containment is irresponsible.**
   Every sub-project below gives the model more freedom to act — deeper
   investigation, longer sessions, more consequential actions. Today,
   Chromium launches directly on the host with full network access. Asking
   the model nicely not to navigate off-target is not a security boundary.

5. **Nothing measures whether any of this actually works.** `haunt-benchmark`
   already exists (built earlier this session) but nothing in the current
   design commits to using it as a standing gate on the harness's own
   effectiveness. Without that, every improvement below is a claim, not a
   measurement.

## Guiding principles

- **Architecture over instructions.** Where a problem can be solved by a
  real technical boundary (network interception, evidence requirements,
  independent verification), that beats a prompt asking the model to
  behave. This is the throughline across all 5 sub-projects.
- **Evidence over vibes.** Every UX/behavioral claim in a final report
  carries a checkable evidence bundle (screenshot, DOM/accessibility
  snapshot, the exact action taken) — a human reviewer should never have
  to take the model's word for it.
- **Named, not invented, patterns.** The investigation loop is built on
  Anthropic's own published orchestrator-worker and evaluator-optimizer
  patterns ("Building Effective Agents"), not bespoke terminology dressed
  up to sound rigorous.
- **Independently shippable.** Each sub-project is useful and testable on
  its own; none requires the others to be finished to prove its worth.
- **Self-measuring.** The program closes its own loop against
  `demo/benchmark-ground-truth.json` (and successors) via `haunt-benchmark`
  — improvement is a number that goes up, not a feeling.

## Program structure — 5 sub-projects, in build order

### 1. Sandboxing (security foundation)

**Goal:** real technical containment for a browser session acting on
instructions from an LLM, independent of what that LLM is told to do.

**Scope:**
- Network egress control at the Playwright layer (`page.route()` /
  `context.route()`): only requests to the target app's own origin (and
  explicitly allowlisted subresource origins the app itself loads, e.g. its
  own CDN) are permitted; everything else is blocked before it leaves the
  browser context — not detected after the fact, prevented.
- Resource limits per session: wall-clock cap, action-count cap, capped and
  path-scoped screenshot/trace storage.
- Credential handling: cookies/passwords from `--email`/`--password` never
  appear verbatim in logs or reports; sessions are torn down deterministically
  after use (session cleanup already exists via `haunt_end_session` /
  `reapStale` — this sub-project audits and hardens that path specifically
  against credential leakage, not just orphaned browsers).

**Explicitly deferred for v2:** OS-level isolation (a container or VM per
session). `page.route()` network interception is a real, enforced boundary
and is the right starting point; full process/OS sandboxing is a much
larger infrastructure investment that this program does not commit to yet.

**Why first:** every sub-project after this one gives the model more
autonomy (longer investigations, more consequential actions, less direct
supervision per action). Containment has to exist before autonomy grows,
not be retrofitted after.

### 2. Perception-bounded actor

**Goal:** make the simulated human's knowledge of the page genuinely
bounded, so its failures to notice things are honest rather than
architecturally impossible.

**Scope:**
- Replace the current "full accessibility tree as text" state description
  with a perception model that approximates what a human would actually
  register scanning the screen: viewport-scoped, salience-ordered, not an
  exhaustive dump of every node.
- Concretely explore screenshot-grounded reasoning (vision) as a either a
  replacement for or a complement to the accessibility tree, since visual
  salience — not DOM structure — is what drives what a human notices.
- This changes the `describeState()` function in `cli/headless.ts` and its
  interactive-mode equivalent; it does not change the underlying Playwright
  tool surface (`haunt_capture_state` can still expose full data for
  debugging/tooling use — the *constraint* is applied when composing what
  the acting persona is shown to reason over).

**Dependency:** none on sub-project 1; can be designed in parallel, but
built second because it's a precondition for sub-project 3's investigation
loop to produce honest (not omniscient) findings.

### 3. Investigation loop

**Goal:** replace the fixed N-step scan with an adaptive, hypothesis-driven
investigation — the actual "real harness, not a basic loop" ask.

**Scope:**
- **Hypothesis queue**, the core data structure:
  `{ id, description, origin, suspicion_level, status, evidence[], depth,
  parent_id }`. Hypotheses are generated from an initial broad recon pass
  and from deepening rounds.
- **Three roles, mapped to Anthropic's published orchestrator-worker /
  evaluator-optimizer patterns:**
  - *Investigator* (orchestrator): picks the highest-suspicion queued
    hypothesis, formulates a specific, falsifiable investigation plan for
    it (e.g. "test 50/150/250/400 characters in the bio field, observe
    timing and console for each" — not "check if this seems off").
  - *Executor* (worker): carries out that plan as bounded, concrete
    Playwright actions via the existing tool surface.
  - *Evaluator*: reviews the round's accumulated evidence against the
    hypothesis and decides: confirmed / refuted / needs more depth. On
    "needs more depth," a narrower child hypothesis is spawned and
    re-queued at higher priority.
- **Concrete stopping conditions**, not vague diminishing returns:
  hard caps (`max_total_actions`, `max_total_llm_calls`, `max_wall_clock`),
  a soft stop when the last K rounds produced neither a new hypothesis nor
  a confirmation, and natural termination when the queue empties.
- **Design constraints carried inside this sub-project's implementation**
  (not separate sub-projects — they're quality attributes of the loop, not
  independently shippable):
  - *Context management*: a multi-round investigation accumulates a trace
    that will not fit usefully in one context window — summarization/
    compaction of settled (confirmed/refuted) hypotheses is required, not
    optional.
  - *Cost-aware model routing*: mechanical execution (fill this field,
    click this element) uses a cheap/fast model; strategic reasoning
    (formulating a hypothesis, judging evidence) uses a stronger one — the
    same model-selection discipline already used to build the benchmark
    tool via subagent-driven development earlier this session.
  - *Executor self-verification*: the Executor confirms its own action had
    the expected effect (e.g. "I clicked save — did the page state
    actually change?") before reporting back to the Evaluator, rather than
    letting the Evaluator be the only check, after the fact, on a chain of
    possibly-false premises.
- Opt-in, not a replacement: exposed as a `--deep` mode alongside the
  existing fixed-step mode, since it costs materially more (an estimated
  15–25 LLM calls per investigation vs. 3 today) — a cheap CI smoke test
  and a deliberate deep audit remain both possible. Cost is surfaced via
  `haunt_estimate_cost` before a deep run starts.
- No new MCP tools: this is orchestration logic recomposing the existing
  `haunt_spawn` / `haunt_navigate` / `haunt_capture_state` /
  `haunt_end_session` tool calls, the same way `runHeadlessTest` already
  does — the MCP surface stays stable.

**Explicitly deferred for v2:** parallel investigation of multiple
hypotheses (separate browser sessions per hypothesis, analogous to today's
parallel multi-persona runs). Sequential is simpler and ships a working
loop faster; parallelism is a later optimization once the sequential loop
is proven.

**Dependency:** sub-projects 1 and 2 (containment and honest perception
must exist before the loop is allowed to run longer and act more
autonomously).

### 4. Verification + confidence

**Goal:** nothing reaches a final report on a single model's unverified
say-so, and not every finding is treated as equally certain.

**Scope:**
- An independent verification pass (architecturally the same role as the
  benchmark's judge, reused/adapted) reviews every hypothesis the
  investigation loop marked "confirmed," checking the claim against its
  own evidence bundle before it's accepted into the final report.
- Findings carry a **confidence score**, not a binary confirmed/refuted —
  mirrors how the benchmark judge's verdicts already needed reconciliation
  against ground truth rather than blind trust.
- **Explicit human-escalation points**: ambiguous findings and anything
  security-relevant or high-impact are flagged for human review rather
  than resolved autonomously. This is not a new idea for this session —
  it's the same posture already applied throughout this conversation
  (stopping for explicit approval before consequential actions).

**Dependency:** sub-project 3 (there is nothing to verify until the
investigation loop produces confirmed hypotheses with evidence bundles).

### 5. Continuous eval loop

**Goal:** close the loop — measure whether this harness is actually
better than v1, and keep measuring as it changes.

**Scope:**
- Extend `haunt-benchmark` (already built) to run the `--deep` investigation
  mode against ground truth, scoring recall/precision/confidence-calibration
  the same way it already scores the fixed-step mode.
- The existing `demo/benchmark-ground-truth.json` covers logic bugs (already
  shown to be better-found by code review) — this sub-project should extend
  ground truth with a runtime-only-bug set (the kind planted and then
  reverted during this session's black-box experiment) as the harness's
  real target class, per the Context section above.
- This becomes a standing gate: every subsequent change to sub-projects 1–4
  gets measured against it, not just shipped on faith.

**Dependency:** sub-project 4 (scoring confidence-calibrated, verified
findings requires that pipeline to exist first).

## Ordering rationale

Security before autonomy (1 before 3/4/5). Honest perception before an
investigation loop that reasons over that perception (2 before 3).
Verification before anything is trusted as a measured result (4 before 5).
Perception (2) has no hard dependency on sandboxing (1) and could be built
in parallel, but is sequenced second here to keep the program to one
active sub-project at a time.

## Out of scope for v2 (explicitly deferred, not abandoned)

The original vision covered five axes (A–E); this program is axis C only.
Deferred:
- **Axis A** — fully goal-directed sessions ("cancel your subscription," no
  fixed persona script). The investigation loop (sub-project 3) is a step
  toward this but stops short of open-ended goal pursuit.
- **Axis B** — configurable user profiles (technical level, patience,
  navigation style) as independent parameters. Personas remain fixed YAML
  configs for v2.
- **Axis D** — trace/video export via dedicated MCP tools
  (`get_trace_url`, `get_action_log`). Evidence bundles (sub-project 3/4)
  cover the same need internally without new tool surface for now.
- **Axis E** — deeper CI/product integration beyond what `haunt-ci` already
  does. Not blocked by this program, just not its focus.
- OS-level sandboxing (container/VM per session) — noted under sub-project 1.
- Parallel hypothesis investigation — noted under sub-project 3.

## Success criteria

- Sub-project 1: a `malicious-user` persona session cannot cause a network
  request to leave the target origin, verified by a test that tries and
  fails.
- Sub-project 2: the persona's state description is demonstrably bounded
  (measurable: smaller/prioritized vs. today's full-tree dump) and this is
  covered by a test asserting the bound.
- Sub-project 3: given the reverted runtime-only-bug fixtures from this
  session's black-box experiment (timing race, CSS overlay, hang bug), a
  `--deep` run finds and correctly narrows at least the CSS overlay and
  hang bugs with root-cause-level evidence (e.g. the actual character
  threshold), not just "something seemed off."
- Sub-project 4: every finding in a final report carries a confidence score
  and an evidence bundle a human can independently check without re-running
  the session.
- Sub-project 5: `haunt-benchmark --deep` produces a repeatable score against
  the runtime-only ground truth set, and that score is the standing
  reference for whether any future change to sub-projects 1–4 is actually
  an improvement.
