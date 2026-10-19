# Part 4, addition: what nine more applications showed

Specification and gate for changes to [part 4](part-4-tester.md) that come
from running it, on 6 October 2026, on nine more applications of CATTest
(8, 22, 24, 27, 30, 41, 43, 46 and 49: 23 annotated bugs). Haunt reported
four of them, and a fifth for a person to check. The agents' transcripts say
why the others were missed; each requirement here answers one cause, and
names the run that showed it.

Requirements are numbered (`R-F1`); every gate test names the ones it proves.

---

## A. A tester that stops with work left

On every one of the nine runs the tester ended its session with cases it had
not played and most of its budget unspent: 11 to 30 actions used of 40, and
between a twentieth and a quarter of the controls exercised on most
applications. On application 27 it entered the app, was shown 64 controls it
had never seen, and ended at 21 actions; both annotated bugs were in those
controls. The brief already says to spend what is left on what remains.
Being told is not enough.

- **R-F1 Held back while work is left.** A session spawned with
  `keep_going` that is asked to end while it has work left is not ended:
  the answer says so, lists the cases without a verdict and the controls a
  user can act on that no action named, how many actions are left, and
  names one thing to do next: the first case without a verdict, or the
  first control never used. Work is left when at least a quarter of the
  budget is, and no case was registered at all, or a case has no verdict,
  or five controls or more of the page as it is were never used. A control
  counts as used when one of the same role, name and group was: a page
  that draws itself again gives its controls new references, and they are
  not new controls. Issues passed with that call are kept. The session stays as
  it was and can act. It is held back three times at most: the fourth call
  ends it, whatever is left. Once was not enough: on 7 October, held back
  once, two testers of three called again at once and ended with 7 and 21
  of their 60 actions used.
- **R-F2 Only when asked, and only with work left.** A session spawned
  without `keep_going` ends at the first call, as before. So does one with
  less than a quarter of its budget left, or with nothing left to do. The
  plugin's testers ask for it.
- **R-F6 No action without a plan, past the first look.** In a session
  spawned with `keep_going`, once a quarter of the budget has been used
  and while no case has been registered, `haunt_act` refuses to act and
  says to take the inventory and register cases; reading the page,
  planning and ending stay possible. The first quarter is for seeing the
  area (R-F4). On 7 October the three testers skipped the plan their own
  steps ask for: they acted with no case, so the engine checked nothing.

## B. A plan written without seeing the application

Part 4 gave the plan to an agent that could not act (R-T20), and the cases
to others. On four of the nine applications that is what cost the most.
Application 27 opens on a prompt for a name: the planner saw 7 of its 71
controls and planned the prompt; the tester played those cases and ended,
and both annotated bugs were in the polls behind. On 24 the "Stop sharing"
button exists only once sharing has started. On 24 and 30 a case named a
control whose name is live text (a timer reading "00:00:11", a card with a
random title), the tester's session could not find it, every case of the
planner was refused with it, and the tester wrote two to four of its own.

The papers haunt's method was taken from say the same. WebTestBench
(arXiv 2603.25226) has this very split, a checklist written from the
instruction alone and an agent that plays it, and names the incomplete
checklist as its main bottleneck: with the right checklist handed over,
F1 goes from 21.9 % to 49.2 % for the same model. CATTest's own agent
(arXiv 2609.00081) is a single one that explores. GUITester
(arXiv 2601.04500) does separate two jobs, but they are acting and
judging, which here is the engine's: expectations checked, issues replayed.

- **R-F4 The one who plans has seen the application.** In the plugin, one
  tester per area does both, in the session it acts in: it first passes
  whatever stands before the application (a name to give, a "Start"), and
  opens what the page keeps closed (tabs, panels, dialogs), within a
  quarter of its budget; then takes the inventory, which by then lists
  what it was shown, and writes the cases by the planner's method, held
  word for word; then plays them. No agent of the plugin plans from a page
  it cannot act on, and no plan passes from one session to another. This
  replaces R-T20 for the plugin: `haunt_plan`'s `from` stays (R-T21), and
  so does `haunt-ci`'s loop, which asks for a plan first (R-T23) and is
  not changed here. Since one session now does what up to three did, the
  command's default budget is 60 actions.

## C. A finding dropped because the page is not the same twice

Application 30 draws its cards at random each time it loads. Twice, on two
different days, a tester saw one of its annotated bugs (a dialog left blank
once a secret has burned) and filed it; twice every replay failed at the
click on a card that was not on the page the replay opened, the issue was
rejected as `not_replayable`, and the report did not mention it. A replay
that could not play the steps has learnt nothing about the issue: it is not
the same as a replay that played them and did not see the defect.

- **R-F5 Not replayable is not rejected.** An issue none of whose replays
  could play its steps is **unchecked**, with the reason `not_replayable`
  and the step that could not be played: listed under "To check by hand",
  in no count, as R-T11 has it for an issue with no claim. An issue whose
  steps a replay played and whose claim it did not see stays rejected
  (R-E9), and so does one naming a case or a signal the session does not
  have.

- **R-F3 The gate is not lying.** Every requirement here is claimed by a
  gate test; none is skipped.

## Gate suites

### F1 — held back while work is left (R-F1, R-F2)

1. With `keep_going`, a case unplayed and budget left: a call to end
   answers that the session has not ended, with the case, the controls
   never used, the actions left and what to do next; an action still runs;
   the session is held back three times, and the fourth call ends it, with
   the issue passed with the first call in its result.
2. Without `keep_going`, the same session ends at the first call.
3. With `keep_going` and less than a quarter of the budget left, it ends at
   the first call; so does one whose cases all have a verdict and which has
   fewer than five controls unused.
4. With `keep_going` and no case registered, it is held back and told to
   plan, however few controls are left.

### F4 — no action without a plan, past the first look (R-F6)

1. With `keep_going` and a budget of 8, two actions run with no case
   registered and the third is refused, naming `haunt_plan`; the page can
   still be read; once a case is registered, actions run again. Without
   `keep_going`, nothing is refused.

### F2 — one tester that plans what it has seen (R-F4)

1. The plugin has no planner agent and the command spawns none: one tester
   per area, with a budget of 60 unless told otherwise. The tester's agent
   may read, act and plan; it holds the tester's brief and the method for
   writing cases word for word; and its own steps are, in this order: see
   the whole area, take the inventory and plan, play.

### F3 — not replayable is not rejected (R-F5)

1. On a page whose buttons are named at random on each load, an issue
   filed after pressing one ends unchecked with the reason and the step,
   and the report lists it under "To check by hand" and counts it nowhere.
   On the same page, an issue whose steps replay and whose claim is false
   is rejected.

### F9 — the gate is not lying (R-F3)

1. Every requirement is claimed by a gate test, and none is skipped.

## Accepted when

F1 to F4 and F9 are green on Linux and macOS and the earlier gates still are.
