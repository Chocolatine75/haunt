# Part 4, addition: a sweep of the buttons no tester pressed

Specification and gate for an addition to [part 4](part-4-tester.md): once
the testers of an area are done, the engine presses the buttons none of them
pressed and reports what breaks.

**Target:** a button wired to nothing, or one whose handler throws, is
reported even when no test case named it, without a model and without a
judgement.

**Why:** the 190 bugs annotated in CATTest were read and sorted by what it
takes to find them
([`benchmarks/2026-10-06-cattest-pilot-part-4.md`](../benchmarks/2026-10-06-cattest-pilot-part-4.md)).
About one in eleven is a control that does nothing, and more end in an
exception. The engine has told both apart since part 2 (`dead_control`,
`js_exception`), but only for a control something clicks. A planner writes
cases for what a page is for; a tester's budget ends; the coverage of every
run so far lists controls "never exercised". Whether pressing one of them
does anything is not a question for a model: the engine can press it and
look.

The hard part is what not to press. A tester decides whether "Delete
account" is worth clicking; a sweep that asks nobody must not. And a button
pressed on a page that the button before it left in another state says
nothing about the page a user opens.

Requirements are numbered (`R-W1`); every gate test names the ones it proves.

## Out of scope

Links (the routes of an app are the scout's), tabs, menu items, fields.
Controls that only appear once something else was pressed: a dialog's
buttons are its tester's. Anything in a form: submitting one is a test case,
with values chosen for it. `haunt-ci`'s loop, which has one session per
route, does not sweep yet.

---

## A. What is pressed

- **R-W1 Buttons nobody pressed.** `haunt_sweep` opens the area in a session
  of its own and presses each control of role `button` that the page shows
  as it loads, that a user can act on (not hidden, disabled or covered), and
  that none of the sessions it is given exercised. A control is the same from
  one session to another by its role, its name and its group (R-T21). Of
  several buttons that are the same by those three, one is pressed: forty
  cards built the same way have one "Add to cart".
- **R-W2 What is left alone.** Not pressed, and listed in the result with
  why: a button inside a form or a search (`in a form`); one with a field
  to type into in the block it sits in, though no form holds them
  (`beside a field`): with the field empty the page rightly does nothing;
  one marked as the current one of a set, by `aria-current`,
  `aria-selected` or a class that says so (`current`): it leads where the
  page already is; one whose name says it destroys, spends, sends or signs
  out, such as "Delete account", "Pay", "Log out" (`destructive`); those
  past the limit, 20 unless `max` says otherwise (`over the limit`).

## B. How

- **R-W3 A real click, on the page as it loads.** Each press is an action of
  the session like a tester's: real input, recorded, with the signals of
  part 2 collected around it. After each press, what it opened is answered
  or closed (a dialog of the browser, a tab) and the area is opened again,
  so that the next button is pressed on the page a user opens, not on what
  the last one left: behind a dialog, on another page, or scrolled
  elsewhere.
- **R-W4 Quiet on what works.** A button that does something raises nothing:
  the sweep adds no signal of its own, and judges nothing. On a page whose
  buttons all work, it reports nothing. A button whose effect is the
  browser's file picker works, though the page does not change. What the
  page raises as it loads is raised once, however many times the sweep
  opened it again or a press brought it back.

## C. Where it goes

- **R-W5 A session like the others.** The sweep ends its session itself: its
  signals are replayed and confirmed as any session's (part 3), and the
  result carries the session's id, which `haunt_generate_report` takes with
  the testers'. What it found is under "Detected automatically"; a button it
  pressed counts as exercised in the coverage of its area.
- **R-W6 On by default, and switchable off.** `/haunt-test` sweeps each area
  once its testers have ended, in one call per area and with no agent;
  `--no-sweep` leaves it out.
- **R-W7 The gate is not lying.** With the sweep made to press what is in a
  form, the gate's check of what was pressed fails; every requirement here
  is claimed by a gate test; none is skipped.

---

## The gauntlet's sweep page

`sw-buttons`, in `?variant=buggy` and `?variant=clean`.

| Button | Buggy | Clean |
|---|---|---|
| Refresh | works | works |
| Export | wired to nothing | works |
| Archive | its handler throws | works |
| Open settings | opens a modal dialog over the page | same |
| Discard draft | asks with a browser `confirm` | same |
| Billing | leaves for another page | same |
| Attach a file | opens the file picker, and changes nothing in the page | same |
| Add to cart (twice, in one list) | works | works |
| Share | disabled | disabled |
| Join, beside an empty field and in no form | does nothing while the field is empty, and must not be pressed | same |
| Go to Documents, marked as the current section | does nothing | same |
| Go to Trash | works | works |
| Delete account | works, and must not be pressed | same |
| Subscribe, in a form | submits, and must not be pressed | same |

## Gate suites

### W1 — what is pressed, and what it finds (R-W1 … R-W4)

1. On the buggy variant, the buttons pressed are exactly those of the table
   that may be, in reading order, each once, the later ones although the
   earlier ones opened a dialog, a `confirm` or another page; the signals
   are the dead "Export" and the exception of "Archive", and no other.
2. On the clean variant, the same buttons are pressed and nothing is raised.
3. The buttons left alone are listed with why: in a form, beside a field,
   current, destructive.
4. A button a session given to the sweep exercised is not pressed again; a
   session id that never existed is refused.
5. With `max: 2`, two are pressed and the rest are listed as over the limit.
6. On a page that raises signals as it loads, each is in the result once,
   and what the presses brought is all there.

### W2 — where it goes (R-W5, R-W6)

1. The sweep's session has ended: its signals are confirmed by their
   replays, and its id is not one a tool can act on any more.
2. A report of a tester's session and the sweep's lists the dead button
   under "Detected automatically" and counts the buttons pressed as
   exercised.
3. The command calls `haunt_sweep` after the testers and documents
   `--no-sweep`.

### W3 — the gate is not lying (R-W7)

1. With forms swept on purpose, the check of what was pressed fails.
2. Every requirement is claimed by a gate test, and none is skipped.

## Accepted when

W1 to W3 are green on Linux and macOS and the earlier gates still are.
