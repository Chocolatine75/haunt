# Part 2 — deterministic signals

Specification and acceptance gate for part 2 of the [roadmap](../ROADMAP.md).

**Target:** everything about a page's misbehaviour that can be established
without asking a model is detected by the engine, every time, with the action
that caused it — and nothing is reported that did not happen.

**Why:** after part 1 the tester acts well, but what it *finds* still depends
on a model noticing it. On the first live runs a small model saw a 500 in the
console and reported nothing; a larger one reported the same bug nine times;
another filed "no error message" on a page that showed one. A server error,
an uncaught exception or a missing label is a fact. Facts should not be left
to judgement, and should not be countable twice.

Requirements are numbered (`R-S1.2`); every gate test names the ones it
proves, as in part 1.

## Out of scope

Whether a signal *matters* to a user, and replaying it to prove it, are part
3. Visual checks (overflow, overlap, contrast as rendered) are part 4. This
part reports what happened, classified and attributed; it does not rank a
missing `alt` against a crashed checkout beyond a default severity.

---

## A. What a signal is

- **R-S1 One shape.** A signal is a record with a `kind`, the page `url` it
  happened on, the `step` it is attributed to, a `message` a person can read,
  a default `severity`, and fields specific to its kind. The shape is fixed
  in `mcp-server/src/gates/part-2/contract.ts`.
- **R-S2 Kinds.**

  | Kind | Raised when | Carries |
  |---|---|---|
  | `http_error` | A response has status 400 or above | method, URL, status, resource type |
  | `request_failed` | A request to the app's own origins gets no response (connection dropped, DNS) | method, URL, the browser's error |
  | `request_hung` | A request has had no response for longer than the hung threshold | method, URL, how long |
  | `slow_response` | A document or data response took longer than the slow threshold | method, URL, how long |
  | `js_exception` | An exception reached the top of the page uncaught | message, stack, source location |
  | `unhandled_rejection` | A promise was rejected with nothing handling it | reason, stack |
  | `console_error` | The page called `console.error` | the text |
  | `long_task` | The main thread was blocked longer than the long-task threshold | how long |
  | `dead_control` | A click on a button, link, tab or menu item changed nothing observable and caused nothing else: no request, no other signal | the element's reference, role and name |
  | `a11y` | An accessibility rule is violated on the page (axe-core) | rule id, impact, the elements' references, help text |

- **R-S3 Default severity.** `critical` is never assigned by the engine.
  `major`: a 5xx on a document or data request, `js_exception`,
  `unhandled_rejection`, `request_hung`, `dead_control`, an `a11y` violation
  of impact critical or serious. `minor`: other `http_error`,
  `request_failed`, `slow_response`, `long_task`, `console_error`, other
  `a11y`. The tester may raise or lower it when it turns a signal into an
  issue; the default is what `haunt-ci` uses when nobody does.
- **R-S4 Thresholds.** Slow response 3 s, long task 500 ms, hung request
  10 s. Each can be set when the session is spawned.
- **R-S5 User feedback.** An `http_error`, `request_failed` or
  `js_exception` attributed to an action says whether any text appeared on
  the page during that action (`feedback: true|false`). "The server answered
  500 and the page said nothing" is the difference between a handled error
  and a silent one, and it is a fact the engine already has.

## B. Attribution

- **R-S6 By cause, not by arrival.** A signal belongs to the action during or
  after which its cause started: a request to the action that was running
  when it was sent, an exception to the action that started what threw it
  (the handler, the timer, the request whose answer it was handling), and to
  the action running or last run only when that cannot be known. Signals
  from the initial load belong to step 0.
- **R-S7 Late signals are not lost and not misfiled.** A signal that arrives
  after its action's result was returned (an exception thrown later, a slow
  response still in flight) is delivered with the next result, still
  attributed to the step that caused it and marked `late`.
- **R-S8 After the last action.** `haunt_end_session` waits for what the last
  action started (within the settle cap) and returns every signal of the
  session, including those nothing had delivered yet.
- **R-S9 Close actions.** Two actions 50 ms apart each get their own signals.

## C. Nothing that did not happen

- **R-S10 Clean pages are silent.** A page with no defect produces no signal:
  not at load, not while being used.
- **R-S11 The sandbox is not the app.** A request blocked by the sandbox, and
  any error that follows only from that block, is never a signal.
- **R-S12 Navigation is not failure.** A request cancelled because the page
  navigated away, a download, a response the page itself aborted: none is a
  `request_failed`.
- **R-S13 One fact, one signal.** The browser's own console line about a
  failed resource is the same fact as the `http_error`; a rejection that also
  reaches `console.error` is the same fact as the `unhandled_rejection`. Each
  fact is reported once. A signal that repeats within a step (the same kind,
  URL and message) is one signal with a `count`; the same failure caused by
  two different actions is two signals, one per step.
- **R-S14 Expected statuses.** A 401 or 403 answering a request while the
  session is not logged in is still reported (as `minor`), since it may be a
  real defect, but is marked `while_logged_out` so that a tester or a report
  can set it aside.

## D. Accessibility

- **R-S15 Audited once per page.** Each distinct page (origin and path) is
  audited with axe-core once, after it has settled, with the WCAG 2 A and AA
  rules. The audit can also be requested for the current state of a page.
  Past 200 text elements in a frame, `color-contrast` (nearly all of an
  audit's time on a long page) is checked on 200 of them, those on screen
  first, and the signal's message says how many it was checked on, of how
  many.
- **R-S16 Violations name their elements.** Each `a11y` signal carries the
  rule id, its impact, and the snapshot references of the offending elements
  where they have one.
- **R-S17 The audit does not disturb the page.** It adds nothing a page script
  can see, changes no element, raises no signal of its own, and its cost is
  not counted in an action's time.

## E. Confidentiality

- **R-S18 No secret in a signal.** URLs are recorded without their query
  string. A value typed into a credential field during the session is removed
  from every message, stack and console text before it is recorded. Response
  and request bodies are never recorded.

## F. Where signals go

- **R-S19 In the action's result.** `haunt_spawn` returns the signals of the
  initial load; `haunt_act` returns the signals delivered with it;
  `haunt_capture_state` can list those of the current page.
- **R-S20 In the session's result.** `haunt_end_session` returns all of them,
  de-duplicated, with their counts.
- **R-S21 In the report.** `haunt_generate_report` takes the sessions'
  signals and renders them in a section of their own, "Detected
  automatically", separate from what the tester judged. An issue filed by the
  tester can name the signal it is about, in which case the signal is shown
  under that issue and not twice.
- **R-S22 In the verdict.** `haunt-ci` exits 1 for a `major` signal exactly as
  for a major issue, so that a weak model cannot turn a server error into a
  passing build.
- **R-S23 Callers updated.** `commands/haunt-test.md` tells the tester what
  signals are and to build its issues on them; `haunt-ci`'s account of the
  last actions includes them.

## G. What must not regress

- **R-S24** The part 1 gate stays green.
- **R-S25** Collecting signals adds no more than 10% to the time of an action
  on the 2,000-element page (reported in CI, enforced locally, like the other
  time budgets).

---

# The gate

In `mcp-server/src/gates/part-2/`, run with `npm run gate`, on the same
principle as part 1: written first, expected to fail until listed in
`status.ts`, asserting on what the page really did.

## The gauntlet's signal pages

Each exists in two variants, `?variant=buggy` and `?variant=clean`, identical
except for the planted defect, and is listed in
`test-support/gauntlet/ground-truth.json` with the signals it must and must
not produce.

| Page | Planted |
|---|---|
| `sig-http` | A `fetch` answered 500, one answered 404, a missing image, a missing stylesheet, a form post answered 422, a document link answered 503, the same failing request made 20 times, a request answered 401 |
| `sig-exceptions` | An exception on click, one 800 ms after a click, one at load, one inside a promise, one 2.5 s after a click (after the action has stopped waiting for the page), one in an event handler of a frame, a `console.error`, a rejection the page also logs with `console.error` |
| `sig-network` | A request whose connection is dropped, one that never answers, one that takes 4 s, one that takes 6.5 s (longer than the settle cap), one that takes 2 s (below the threshold), one cancelled by the page itself, one cancelled by navigating away, a download |
| `sig-blocking` | A 600 ms main-thread block on click, a 120 ms one (below the threshold) |
| `sig-dead` | A button wired to nothing, a link going nowhere (`href="#"` with no handler), a tab that does not switch — and working ones beside them |
| `sig-a11y` | Twelve violations, one per rule: image without `alt`, button without a name, link without a name, input without a label, select without a name, low contrast text, missing `lang`, empty page title, ARIA role without its required attribute, invalid ARIA attribute value, list item outside a list, frame without a title. Two of them a second time, inside an open shadow root and inside the frame |
| `sig-silent` | A save that fails with a 500 and shows nothing; the same failing with a visible message |
| `sig-secrets` | Requests and exceptions whose URL, message and stack contain what was typed into a password field |

## Gate suites

### S1 — every kind is detected, exactly (R-S1 … R-S5)

1. For each planted defect of each page, the session produces the signal the
   ground truth lists: kind, URL without query, the fields of its kind, and
   the default severity.
2. The count of signals on each buggy page equals the ground truth: nothing
   extra.
3. Thresholds: the 120 ms block and a 2 s response are not signals; with the
   thresholds lowered at spawn, they are.
4. On `sig-silent`, the two failures differ only by `feedback`.
5. `dead_control` is raised for the three dead controls and for none of the
   working ones, including a working one whose only effect is to move focus
   or scroll.

### S2 — clean is silent (R-S10)

1. Every clean variant, loaded and put through the same actions as its buggy
   twin, produces zero signals.
2. Each of the 19 part 1 gauntlet pages, loaded and left alone for two
   seconds, produces zero signals other than those its own description
   plants.
3. The whole part 1 gate, run with signals collected, produces none on the
   pages that plant none.

### S3 — attribution (R-S6 … R-S9)

1. Each signal of S1 carries the step of the action that caused it; load-time
   ones carry step 0.
2. The exception thrown 800 ms after a click is attributed to that click
   and delivered with its result. The one thrown 2.5 s after a click, once
   the action has returned, is attributed to that click whatever was done in
   between, and delivered with the next result, marked `late`.
3. Two clicks 50 ms apart, each triggering its own failing request: each
   signal is attributed to its own click, over 30 repetitions.
4. A response slower than the settle cap, started by action 1 and finishing
   during action 3, is attributed to step 1.
5. An exception and a hung request caused by the last action, never followed
   by another, are in `haunt_end_session`'s result.

### S4 — nothing that did not happen (R-S11 … R-S14)

1. Every escape route of the part 1 `escape` page produces a sandbox block
   and no signal; nor does the `console` line the browser prints about it.
2. The request cancelled by the page and the one cancelled by navigation are
   not signals. A download is not one.
3. A 500 produces one signal, not one for the response and one for the
   browser's console line. A rejection logged with `console.error` produces
   one.
4. The same failing request made 20 times is one signal with `count: 20`.
5. A 401 while logged out is marked `while_logged_out`; the same 401 with the
   session's cookies is not.

### S5 — accessibility (R-S15 … R-S17)

1. `sig-a11y` buggy: exactly the twelve rule ids, each with the reference of
   its element. Clean: none.
2. A page visited five times in a session is audited once; an explicit
   request audits its current state.
3. A violation inside a frame and one inside an open shadow root are found.
4. Before and after an audit, the page's DOM, its registry of events and its
   snapshot are identical; no signal is raised by the audit.

### S6 — confidentiality (R-S18)

1. After typing a secret into a password field on `sig-secrets` and
   triggering each of its failures, the secret appears in no signal, no tool
   result, no report and no file written — searched as in part 1's G5.2.
2. No signal carries a query string.

### S7 — where signals go (R-S19 … R-S23)

1. The same signals, with the same steps, are in the action results, in
   `haunt_end_session` and in the generated report's JSON sidecar.
2. The report has a "Detected automatically" section listing them; an issue
   naming a signal absorbs it.
3. `haunt-ci`, with a decider that reports no issue at all, exits 1 on
   `sig-http` buggy and 0 on its clean variant.
4. The command prompt mentions signals and no tool the server lacks.

### S8 — the gate is not lying, and nothing regressed (R-S24, R-S25)

1. **Sabotage**, each of which must turn at least one test red: late signals
   dropped; everything attributed to the latest step; sandbox blocks reported
   as signals; no de-duplication; the browser's console line counted as a
   second signal; 4xx ignored; the audit skipped; the audit run on every
   action; secrets left in messages; signals after the last action dropped.
2. Every requirement id of this document is claimed by a gate test.
3. The part 1 gate passes unchanged.
4. The signal overhead budget (R-S25), run with the other time budgets.

## Accepted when

S1 to S8 are green on the three systems, the part 1 gate still is, and a live
`/haunt-test` run on `demo/` reports the planted 500 on signup as a signal
without the model having to notice it.
