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

- **R-F1 Held back once.** A session spawned with `keep_going` that is asked
  to end while it has work left is not ended: the answer says so, lists the
  cases without a verdict and the controls a user can act on that no action
  named, and how many actions are left. Work is left when at least a
  quarter of the budget is, and either a case has no verdict or five
  controls or more were never used. Issues passed with that call are kept.
  The session stays as it was: it can act, and the next call to end it
  ends it, whatever is left.
- **R-F2 Only when asked, and only with work left.** A session spawned
  without `keep_going` ends at the first call, as before. So does one with
  less than a quarter of its budget left, or with nothing left to do. The
  plugin's testers ask for it; a planner, which plays nothing, does not.
- **R-F3 The gate is not lying.** Every requirement here is claimed by a
  gate test; none is skipped.

## Gate suites

### F1 — held back once (R-F1, R-F2)

1. With `keep_going`, a case unplayed and budget left: the first call to end
   answers that the session has not ended, with the case, the controls
   never used and the actions left; an action still runs; the second call
   ends it, and the issue passed with the first call is in its result.
2. Without `keep_going`, the same session ends at the first call.
3. With `keep_going` and less than a quarter of the budget left, it ends at
   the first call; so does one whose cases all have a verdict and which has
   fewer than five controls unused.

### F9 — the gate is not lying (R-F3)

1. Every requirement is claimed by a gate test, and none is skipped.

## Accepted when

F1 and F9 are green on Linux and macOS and the earlier gates still are.
