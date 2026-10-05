# Part 4 — a tester, not a persona

Specification and acceptance gate for part 4 of the [roadmap](../ROADMAP.md).

**Target:** haunt tests a page the way a QA engineer does. It lists what the
page offers, plans a test for each thing, says what it expects before it
acts, checks what it got, and stops when the plan is covered or the budget is
spent. The engine keeps the plan and the coverage; the model fills them in.

**Why:** on 5 October 2026 haunt was run on three applications of CATTest, a
published benchmark of web apps with hand-annotated bugs, next to Claude Code
driving Microsoft's Playwright MCP and Claude in Chrome
([`docs/benchmarks/2026-10-05-cattest-pilot.md`](../benchmarks/2026-10-05-cattest-pilot.md)).
Of four annotated bugs, haunt v1 and v2 found none; each of the two plain
Claude setups found one. The session logs say why:

- The persona typed `asdfghjkl` and a script tag into a search box and
  stopped after three steps. Claude typed `chicken` and `garlic`, pressed
  every button, and found that "Titles only" also searched descriptions.
- Claude read the exact list of result titles and compared it with what the
  button promised. Haunt's tester had the page's text and no way to state
  "every title in this list contains the word" as something to check.
- Haunt's tester saw one of the defects ("filters combine as OR") and wrote
  that it was "not a defect I could check": part 3 rejects an issue with no
  claim the engine can replay, so it was dropped rather than shown.

The tools that do this well share a method (CATJudge's explorer, browser-use's
agent loop, WebTestBench's checklist, minitap's mobile-use): an explicit plan,
an expected result before each action, a check after it, and a second pass
that confirms. minitap also splits the work between agents with one job
each, and reports that as its largest gain; section I takes that up. Parts 1 to 3 gave haunt the hands, the instruments and the
proof; this part gives it the method. Signals, replays and the handling of
secrets stay as they are: they are what the plain setups do not have.

Requirements are numbered (`R-T1`); every gate test names the ones it proves.

## Out of scope

Visual checks done by the engine (overflow, overlap, a layout that shifts)
and screenshot-driven action are part 5. Reading a codebase to derive the
plan is not in this part: the plan comes from the page and, when given, a
written description of the app. A screenshot at every step, as computer use
takes, is left out on purpose: it is taken on request (R-T13), which keeps
a run short and cheap. Choosing a model is left to the host.

---

## A. The plan

- **R-T1 What the page offers.** `haunt_plan` returns the page's
  **inventory**: every control a user can act on in the current snapshot, by
  reference, with its role, name and the group it belongs to (the form, the
  region or the list that contains it). Hidden, disabled and covered controls
  are listed as such, not left out. The inventory is computed by the engine
  from the snapshot; two calls on an unchanged page return the same one.
- **R-T2 Test cases.** The tester registers cases with `haunt_plan`: an id,
  the controls it exercises (references from the inventory), a kind (`normal`
  use, `edge` input, `state` change, `keyboard`, `visual`) and what is
  expected, in one sentence. A case naming a reference the page does not
  have is refused with the reason.
- **R-T3 The plan follows the page.** When an action brings controls a user
  could not act on before (a dialog that opens, a new page, results), the
  action's result names them, and they are in the inventory as usable and
  not yet planned.
- **R-T4 Coverage is counted by the engine.** A control is **exercised** once
  an action that succeeded named it. A case is **run** once it has a verdict
  (R-T7). `haunt_plan` and `haunt_end_session` return, at any time: controls
  exercised of those listed, cases run of those planned, and the list of what
  is left. Nothing in that count comes from the model's own account.

## B. Budget

- **R-T5 A budget of actions, not three steps.** A session has a budget of
  actions (default 40, settable at spawn as `budget` and with `--steps`).
  It is the step limit the engine already had, which the command capped at
  three. Every `haunt_act` result carries what is left of it.
- **R-T6 Told when it runs short.** From three quarters of the budget, each
  result also lists the controls and cases still untouched, so the rest goes
  to what matters. At zero, `haunt_act` refuses further actions and says to
  end the session; reading the page and ending it stay possible.

## C. Expect, act, check

- **R-T7 An expectation is stated before the action.** `haunt_act` accepts,
  with its actions, the case they belong to and an `expect`: an observation
  the engine checks once the page has settled. The result says whether it
  held, with what was read. That is the case's verdict: `passed` or `failed`.
  A case can also be closed by the tester with a verdict of its own and a
  sentence, when what it expects is not something the engine can read
  (R-T11).
- **R-T8 Reading a list exactly.** Observations gain `list`: for a container
  named by its role and accessible name (a list is not a control and has no
  reference), the elements of a given role under it, their texts as the page
  shows them, and a condition on them: `count` equal to, at least or at most
  a number; every item contains, or none contains, a text; items are in
  ascending or descending order, as numbers or as text; the items are
  exactly a given list. `haunt_capture_state` returns the same list on
  request, so the tester can look before it states.
- **R-T9 Reading a value.** Observations gain `value`: what a control holds
  or its state (`checked`, `expanded`, `pressed`, `focused`), compared with
  an expected one. A credential field's value is
  never returned or compared in clear: it is `(filled)` or `(empty)`, as in
  the snapshot.
- **R-T10 A failed expectation is an issue's claim.** An issue can name a
  case whose check failed instead of repeating the observation. Its replay
  (part 3) runs the case's steps and evaluates the same observation. Part
  3's rules apply unchanged: three replays, confirmed, flaky or rejected.

## D. Nothing seen is dropped in silence

- **R-T11 Unchecked, not rejected.** An issue with no claim the engine can
  check is no longer rejected for that. Its steps are still replayed, to
  establish that they run; it is then **unchecked**, listed in the report
  under "To check by hand" with its steps and what the tester expected and
  saw. It is in no count and does not change `haunt-ci`'s verdict. This
  replaces the first case of R-E9; an issue that names a signal the session
  does not have, or whose claim no replay reproduces, is rejected as before.
- **R-T12 The report shows what was tested.** It gains a "Coverage" section:
  controls exercised of those listed, cases passed, failed and not run, and
  the controls never touched, by name. A report that found nothing says what
  that nothing rests on.

## E. Seeing the page

- **R-T13 A screenshot on request.** `haunt_capture_state` with
  `include_screenshot` returns an image of the viewport along with the
  snapshot, credential fields masked (R-E15). The engine has had it since
  part 3; what changes is that the tester is told to use it for what text
  cannot say: a card that jumps, a layout that overlaps.

## F. What the tester is told

- **R-T14 No personas.** They are removed: the `--personas` flag, the
  `personas/` directory and its loader, and every mention of one in what
  haunt returns or writes. `haunt_spawn` opens a session without one. The
  inputs that carried a persona stay accepted and are ignored, since a
  caller written before this part passes them. The brief the tester gets is
  the method: inventory, plan each control's normal use with realistic
  values, state the expectation, check it, then edge cases, keyboard and
  state changes. What two of the personas were for stays as case kinds:
  `keyboard` (reaching and operating a control without a pointer) is part of
  every plan, and attack payloads (`hostile`) are planned only with
  `--hostile`, since they must only be sent to an app the user owns. A report
  written before this part, with personas in it, can still be compared with.
- **R-T15 A description of the app, if there is one.** `--spec` takes a file
  or a text describing what the app is meant to do. It is given to the tester
  verbatim with the brief, and named in the report. Nothing else reads it.

## G. Not going in circles

- **R-T16 Repeats are flagged.** When the same action on the same control
  has left the page unchanged three times in a session, the result says so
  and names the controls not yet exercised. The action is not refused: a
  tester may have a reason. It still counts against the budget.

## H. One job each

A single agent that plans, acts and judges in one context does each of them
worse: the plan is forgotten as the snapshots pile up, and a tester that
wrote the plan tests what it already believes works.

- **R-T20 Two roles under an orchestrator.** A **planner** reads an area's
  inventory, and the description of the app when there is one, and writes
  its test cases; it reads and does not act. **Testers** play the cases they
  are handed, one group of controls each, in a browser session of their own,
  at the same time; they state expectations, read results and file issues,
  and do not plan beyond what a result brings. The orchestrator spawns them,
  hands the plan over, and assembles the report; it tests nothing itself.
  The plugin ships each role as an agent of its own, and the planner's is
  given no tool that acts on a page: a boundary, not an instruction.
- **R-T21 A plan passes from one session to another.** `haunt_plan` returns
  each case in a form another session of the same page can take: its
  controls by role, name and group instead of by reference. Registered
  there, they are resolved to that session's references; a case naming a
  control that session does not have is refused, with the control named.
- **R-T22 Coverage is of the app, not of each session.** Sessions that
  tested the same area count each control once in the report, exercised if
  any of them exercised it, and each case once. Different areas add up.
- **R-T23 The same separation in `haunt-ci`.** Its loop asks for the plan
  first, in a call of its own that carries the planner's brief and the
  inventory, registers the cases returned, then asks for the actions of one
  case at a time under the tester's brief, with the case and what it
  expects in front of the model. A decider that returns no case still gets
  its session: it explores, as before.

## I. What must not regress

- **R-T17 Earlier gates.** The part 1, 2 and 3 gates pass unchanged, except
  two tests this part makes wrong, each changed in a pull request of its
  own with this section as the reason: E3.1, which proves the first case of
  R-E9 that R-T11 replaces; and G5.6, which lists the test files that must
  not be deleted and names the two of the persona loader, removed with it by
  R-T14. The fingerprints the later gates keep of the earlier ones (S8.3,
  E7.3, T6.3) follow.
- **R-T18 Callers updated.** `commands/haunt-test.md` and `haunt-ci`'s loop
  follow the method; the zod schemas in `src/mcp/tools.ts` define every new
  input; `dist/` is rebuilt.
- **R-T19 The gate is not lying.** As in earlier parts: each requirement is
  claimed by a gate test, a sabotage of each property makes its test fail,
  and no gate test is skipped.

---

## The gauntlet's tester pages

Each in `?variant=buggy` and `?variant=clean`, listed in
`test-support/gauntlet/ground-truth.json`. They are functional defects: the
page answers, raises no signal, and is wrong.

| Page | Planted |
|---|---|
| `qa-search` | A search with a "Titles only" switch that also matches descriptions |
| `qa-filters` | Two filters that combine as "or" where the page says "and", and a result count that disagrees with the list |
| `qa-sort` | A "Price, low to high" order that sorts prices as text; a disabled button, a toggle and a disclosure, for the states |
| `qa-form` | A form whose "Remember me" box is unchecked again after saving, and a quantity field that accepts a negative number |
| `qa-rating` | Star ratings that always show five, whatever the score next to them |
| `qa-dialog` | A dialog that opens with controls the page did not have, and a Tab key that leaves it for the page behind |

## Gate suites

Deterministic, with a scripted tester, as in parts 1 to 3.

### T1 — the plan (R-T1 … R-T4)

1. On each tester page, the inventory is exactly the controls listed for it
   in the ground truth, with their groups; hidden and disabled ones marked.
2. A case naming an unknown reference is refused; a valid one is listed.
3. After opening `qa-dialog`'s dialog, its controls are in the inventory as
   not planned, and the result of the action said so.
4. Coverage after a scripted session equals the count in the ground truth:
   controls exercised, cases run, and the names of what is left.

### T2 — budget (R-T5, R-T6)

1. With a budget of 8, the eighth action's result says 0 left, the ninth is
   refused, and capture and end still work.
2. The sixth result lists what is untouched; the fifth does not.

### T3 — expect, act, check (R-T7 … R-T10)

1. For each planted defect, the expectation a correct tester states fails on
   the buggy variant and holds on the clean one, and the result carries what
   was read.
2. Each `list` condition (count, every, order as numbers and as text) and
   each `value` state, on a page built for it, both ways.
3. A password field's value is never in a result, a report or a bundle.
4. An issue naming a failed case is confirmed by three replays on the buggy
   variant, and rejected when filed against the clean one.

### T4 — nothing dropped (R-T11, R-T12)

1. An issue with no checkable claim ends unchecked, is under "To check by
   hand" with its steps, is in no count, and `haunt-ci` exits 0 with only
   that.
2. An issue naming a signal the session does not have is still rejected.
3. The report's coverage section matches the engine's count, and names the
   controls never touched; a report of sessions that carry no inventory has
   no such section.

### T5 — seeing, the brief, repeats (R-T13 … R-T16)

1. A screenshot is returned on request; with the login page's fields filled,
   it is the same image as with them empty.
2. `haunt_spawn` opens a session without a persona; no tool result, report
   or sidecar has one in it; a report compared with one written before this
   part still gets its comparison. A `hostile` case is refused without
   `--hostile` and accepted with it.
3. `--spec` reaches the decider of `haunt-ci` verbatim, and the report names
   it; without one the decider is given the method and no character to play.
4. The third unchanged repeat of an action is flagged, with what is left to
   exercise; the second is not.

### T6 — the gate is not lying, and nothing regressed (R-T17 … R-T19)

1. Sabotage: with each property broken on purpose (hidden controls left out
   of the inventory, coverage counted from the plan, an expectation assumed
   to hold, a list read outside its container, the budget ignored, a
   credential read in clear, an unchecked issue confirmed, a case's issue
   not replayed), the gate test of that property fails.
2. Every requirement of this document is claimed by a gate test, every
   numbered test here exists, and none is skipped.
3. The files of the part 1, 2 and 3 gates are what they were when this part
   started.

### T7 — one job each (R-T20 … R-T23)

1. The cases of a session register in another session of the same page, by
   what their controls are, and play there; one naming a control that
   session does not have is refused.
2. Two sessions on one area count its controls once in the report, and its
   cases once; a second area adds to them.
3. `haunt-ci` asks for a plan before any action, under the planner's brief
   and with the inventory; the cases come back in the session's result; each
   later call is under the tester's brief and names the case to play. A
   decider that plans nothing still runs.
4. The plugin has an agent for each role; the command names both; the
   planner's has no tool that acts on a page; neither names a tool the
   server does not provide.

### T8 — live

Run by hand, three times, scorecards under `docs/benchmarks/`: on the three
CATTest applications of the pilot, with the same model, against Claude Code
with Playwright MCP, haunt's worst run of three against the other's best.
Finding as many of the annotated bugs for a lower cost per application
passes. Finding more passes, whatever it costs. Finding more for less is the
result to aim for, and the scorecard says which of the three it was. Finding
fewer fails, as does finding as many for the same cost or more. The runner
and the prompts given to each tool are committed with the scorecards.

## Accepted when

T1 to T7 are green on Linux and macOS, the earlier gates still are, and T8's
scorecards are committed and meet its rule.
