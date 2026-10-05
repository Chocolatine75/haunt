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
that confirms. Parts 1 to 3 gave haunt the hands, the instruments and the
proof; this part gives it the method. Signals, replays and the handling of
secrets stay as they are: they are what the plain setups do not have.

Requirements are numbered (`R-T1`); every gate test names the ones it proves.

## Out of scope

Visual checks done by the engine (overflow, overlap, a layout that shifts)
and screenshot-driven action are part 5. Reading a codebase to derive the
plan is not in this part: the plan comes from the page and, when given, a
written description of the app. Choosing a model, or splitting the work
between several agents, is left to the host.

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
- **R-T3 The plan follows the page.** When an action brings controls that
  were not there (a dialog, a new page, results), the action's result says
  so, and they are added to the inventory as not yet planned.
- **R-T4 Coverage is counted by the engine.** A control is **exercised** once
  an action that succeeded named it. A case is **run** once it has a verdict
  (R-T7). `haunt_plan` and `haunt_end_session` return, at any time: controls
  exercised of those listed, cases run of those planned, and the list of what
  is left. Nothing in that count comes from the model's own account.

## B. Budget

- **R-T5 A budget of actions, not three steps.** A session has a budget of
  actions (default 40, settable at spawn and with `--steps`). Every
  `haunt_act` result carries what is left of it.
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
- **R-T8 Reading a list exactly.** Observations gain `list`: for the items
  of a container named by reference (or the elements of a role under it),
  their texts as the page shows them, and a condition on them: `count`
  equal to, at least or at most a number; `every` item contains (or does not
  contain) a text; items are in ascending or descending order, as numbers or
  as text. `haunt_capture_state` returns the same list on request, so the
  tester can look before it states.
- **R-T9 Reading a value.** Observations gain `value`: what a field holds, or
  an element's state attribute (`checked`, `selected`, `expanded`,
  `pressed`), compared with an expected one. A credential field's value is
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
  `screenshot: true` returns an image of the viewport along with the
  snapshot. Credential fields are masked in it, as in the evidence bundle's
  (R-E15). It is how the tester judges what text cannot say: a card that
  jumps, five stars where there should be three.

## F. What the tester is told

- **R-T14 No personas.** They are removed: the `persona` input of
  `haunt_spawn`, the `--personas` flag, the `personas/` directory and its
  loader, and the persona column of reports. The brief the tester gets is
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

## H. What must not regress

- **R-T17 Earlier gates.** The part 1, 2 and 3 gates pass unchanged, except
  the one test that proves the first case of R-E9 (E3.1), which R-T11
  replaces: it is changed in its own pull request, with this section as the
  reason.
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
| `qa-sort` | A "Price, low to high" order that sorts prices as text |
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
   controls never touched.

### T5 — seeing, the brief, repeats (R-T13 … R-T16)

1. A screenshot is returned on request; with the login page's fields filled,
   it is the same image as with them empty.
2. `haunt_spawn` takes no persona and refuses one as an unknown input; no
   tool result, report or sidecar has a persona in it; a report compared
   with one written before this part still gets its comparison. A `hostile`
   case is refused without `--hostile` and accepted with it.
3. `--spec` reaches the decider of `haunt-ci` verbatim, and the report names
   it.
4. The third unchanged repeat of an action is flagged, with what is left to
   exercise; the second is not.

### T6 — the gate is not lying, and nothing regressed (R-T17 … R-T19)

As E7: sabotages, every requirement claimed, no skipped test, and the
fingerprints of the earlier gates.

### T7 — live

Run by hand, three times, scorecards under `docs/benchmarks/`: on the three
CATTest applications of the pilot, with the same model, against Claude Code
with Playwright MCP, haunt's worst run of three against the other's best.
Finding as many of the annotated bugs for a lower cost per application
passes. Finding more passes, whatever it costs. Finding more for less is the
result to aim for, and the scorecard says which of the three it was. Finding
fewer fails, as does finding as many for the same cost or more. The runner
and the prompts given to each tool are committed with the scorecards.

## Accepted when

T1 to T6 are green on Linux and macOS, the earlier gates still are, and T7's
scorecards are committed and meet its rule.
