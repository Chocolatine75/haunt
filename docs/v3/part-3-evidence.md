# Part 3 — evidence and verification

Specification and acceptance gate for part 3 of the [roadmap](../ROADMAP.md).

**Target:** nothing reaches a report on a model's word alone. Every issue in a
report comes with the steps that produce it, those steps have been replayed
in a fresh browser before the report was written, and the report says how
often they reproduced it.

**Why:** after part 2 the engine detects what can be detected without a
model, but an issue is still whatever the tester wrote. A model can file a
bug that never happened, merge two, or describe one it saw once and that
does not come back. The September experiment (`HISTORY.md`) found false
positives on every haunt run. A report a developer can trust is one where
each issue can be replayed with one command, and was.

Requirements are numbered (`R-E1`); every gate test names the ones it
proves, as in parts 1 and 2.

## Out of scope

Shortening the steps to the fewest that still reproduce (minimisation),
turning a confirmed issue into a regression test, and replaying when the
page's markup has changed are part 5. Judging how bad an issue is stays
with the tester. Visual checks are part 4.

---

## A. What an issue must be about

- **R-E1 A checkable claim.** An issue is accepted only if the engine can
  check it by itself. It is about either:
  - a **signal** of the session (part 2), named by its id (`signal: "s3"`):
    it holds when replaying the steps raises the same signal; or
  - an **observation**: a fact about the page after a given step that the
    engine can read back (`observed`), one of
    - `text_present` / `text_absent`: a text is, or is not, on the page;
    - `url`: the page's address contains a string;
    - `element`: the element a reference named has a state (`visible`,
      `hidden`, `disabled`, `enabled`, `gone`).
  An issue with neither is rejected (R-E9).
- **R-E2 Its step.** An issue says at which step its claim holds: the
  signal's own step, or `observed.step` (the last step if omitted).
- **R-E3 Same signal.** Two signals are the same when kind, request path
  without query, status or error, rule and message are equal. The step, the
  count and timings are not compared.

## B. The steps that lead to it

- **R-E4 Recorded as they ran.** The engine keeps every action of the
  session as it was executed, with what it needs to run again in a browser
  that has never seen the page: the start URL, the viewport, and for each
  action its parameters and, for each reference, a **locator** — role,
  accessible name, the index among elements with the same role and name, and
  the path of frames and shadow roots. References themselves are not
  replayable: another session numbers elements differently.
- **R-E5 What a replay is.** A replay opens a new browser with the session's
  spawn options (thresholds, viewport; cookies only if passed again, never
  stored), runs the recorded actions up to the issue's step, waits for that
  step's late signals as `haunt_end_session` does (R-S8), and checks the
  claim. An action whose locator matches no element, or more than one, ends
  the replay as `not_replayable` with the step that failed.
- **R-E6 Failed actions are skipped.** An action that failed in the session
  changed nothing and is not replayed.
- **R-E7 Secrets stay out.** A value typed into a credential field is
  recorded as a placeholder (`{{secret:1}}`). A replay takes the values from
  its caller; a bundle never holds them (R-E15).

## C. Verification and confidence

- **R-E8 Replayed before it is reported.** `haunt_end_session` replays every
  issue of the session. A replay runs up to three times; if it reproduces
  every time, the issue is **confirmed**. If one of the three does not,
  replays continue up to ten in all, and the issue is **flaky**, with its
  observed rate (reproduced / attempts).
- **R-E9 Rejected.** An issue whose claim is not checkable (R-E1), whose
  signal id does not exist in the session, or that no replay reproduces is
  **rejected**: it is not in the report's issues, and the sidecar lists it
  with the reason.
- **R-E10 Signals verify themselves too.** A signal no issue names is
  replayed the same way before it is listed under "Detected automatically",
  and carries its own status. A signal that never reproduces is listed as
  flaky with rate 0 rather than dropped: the engine saw it happen.
- **R-E11 Time is bounded.** Replays of one session run in parallel, a few
  browsers at a time, and stop at a time budget (default two minutes per
  session, settable at spawn). An issue not verified within it is
  **unverified**, listed apart, and never counted as confirmed.
- **R-E12 What the report shows.** Confirmed issues are the report's issues.
  Flaky ones get a section of their own with their rate. `haunt-ci`'s verdict
  counts confirmed issues and confirmed major signals only.

## D. The evidence bundle

- **R-E13 One per issue.** Each confirmed or flaky issue (and signal) has a
  directory next to the report holding:
  - `steps.json`: what R-E4 records, up to its step, replayable on its own;
  - `screenshot.png`: the page at that step, from a replay that reproduced
    it;
  - `trace.zip`: the Playwright trace of that replay;
  - `network.json`: the requests of that replay: method, URL without query,
    status, timing. No header, no body;
  - `signal.json`: the signal it is about, as the replay raised it;
  - `verification.json`: attempts, reproductions, status, rate.
  The evidence comes from a replay, not from the session: a replay is short,
  clean, and is itself the proof.
- **R-E14 Replay from the bundle.** `haunt_replay` takes a bundle (or a
  `steps.json`) and replays it, with nothing else but optional secrets and
  cookies, and returns whether the claim held. So does a command a developer
  can run.
- **R-E15 No secret anywhere.** No password, email or cookie value of the
  session appears in any file of a bundle — the trace archive's entries
  included — nor in the report, its sidecar or a log. Credential fields are
  masked in screenshots; URLs lose their query strings; the trace is
  rewritten so that no spelling of a secret remains (R-S18's forms). The
  secrets are what was typed into a credential field, what the host passes
  to `haunt_spawn` as `secrets` (the account a session was signed in with
  elsewhere), and every cookie value and bearer token the session sent or
  was sent, the ones the server set along the way included.
- **R-E16 Storage is capped.** A bundle stays under 5 MB and a report's
  bundles under 50 MB. Over the cap the trace is dropped first (marked so),
  then screenshots; `steps.json` and `verification.json` always stay. A
  200-step session's bundles stay under the cap.

## E. Where it goes

- **R-E17 Tools.** `haunt_act` and `haunt_end_session` accept issues with
  `signal` or `observed`. `haunt_end_session` returns each issue with its
  verification and bundle path, and the rejected ones with their reason.
  `haunt_generate_report` renders confirmed, flaky and unverified apart and
  links each to its bundle.
- **R-E18 Callers updated.** `commands/haunt-test.md` tells the tester that an
  issue must name a signal or an observation, and what happens to one that
  does not; `haunt-ci`'s decider is told the same.

## F. What must not regress

- **R-E19** The part 1 and part 2 gates stay green.
- **R-E20** Recording the steps adds no more than 5% to an action's time on
  the 2,000-element page. Replays are not counted in action time.

---

# The gate

In `mcp-server/src/gates/part-3/`, run with `npm run gate`, written first and
expected to fail until listed in `status.ts`, as in parts 1 and 2.

## The gauntlet's evidence pages

Each in `?variant=buggy` and `?variant=clean`, listed in
`test-support/gauntlet/ground-truth.json` with the issue a correct tester
files on it, its claim and its expected status.

| Page | Planted |
|---|---|
| `ev-sequence` | A 500 that needs three steps: fill a field, choose an option, submit. Any two of them alone do not trigger it |
| `ev-flaky` | A save that fails with a 500 on one request in five, by a counter on the server, so the rate is exact |
| `ev-late` | An exception 2.5 s after a click, once the action has returned |
| `ev-silent` | A form whose error message never appears (an observation: `text_absent`) and the same form that shows it |
| `ev-frames` | A failing request from a button inside a frame, and one inside an open shadow root |
| `ev-login` | A page behind a login whose failure needs the password typed again on replay |
| `ev-long` | A list where the failure needs 200 steps to reach, for the storage cap |

## Gate suites

### E1 — every issue replays (R-E1 … R-E6, R-E13, R-E14)

1. For each buggy page, a scripted session files the ground truth's issue;
   the report lists it as confirmed, and the test, given only its bundle,
   replays it with `haunt_replay` in a new MCP server and gets the same
   signal or observation.
2. `steps.json` names no reference: the replay works in a server that has
   issued none.
3. The steps of `ev-sequence` replay in order, and a replay of any two of
   the three does not reproduce it.
4. Elements inside a frame and an open shadow root are found again by their
   locators.
5. A failed action in the session is absent from the steps.

### E2 — confidence (R-E8, R-E10, R-E11, R-E12)

1. `ev-flaky`'s issue is reported as flaky with rate 0.2 (2 of 10), not
   confirmed and not dropped.
2. A confirmed issue took exactly three replays.
3. `ev-late`'s exception is reproduced: the replay waits for it.
4. With the time budget set to one second, issues are unverified, listed
   apart, and `haunt-ci` does not count them.

### E3 — nothing on a model's word (R-E1, R-E9)

1. An issue with no signal and no observation is rejected with that reason.
2. An issue naming a signal id that does not exist is rejected.
3. An observation that is false (`text_present` of a text that never
   appears) is rejected after its replays.
4. On every clean variant, the ground truth's issue filed anyway is rejected.

### E4 — secrets (R-E7, R-E15)

1. On `ev-login`, after typing a password and an email and passing cookies,
   no spelling of any of them appears in any file of any bundle — every
   entry of every trace archive unzipped and searched — nor in the report,
   the sidecar or anything written during the test.
2. The screenshot of a filled password or email field shows it masked.
3. The replay of `ev-login` reproduces with the secrets passed to it, and
   fails as `not_replayable` without them.
4. A session opened with the cookies of an `ev-login` login and the account
   passed as `secrets`, whose server sets a new session cookie on every
   response and whose page carries the account's email in its data and sends a bearer
   token: no spelling of the email, the password, any session cookie the
   server handed out or any bearer token appears in any file written or in
   the tool results after the cookies were asked for.

### E5 — storage (R-E16)

1. `ev-long`'s 200-step bundle is under 5 MB.
2. Ten bundles of one report stay under 50 MB; past the cap the trace is
   dropped and marked, `steps.json` stays.

### E6 — where it goes (R-E17, R-E18)

1. `haunt_end_session` returns each issue's status, rate and bundle path,
   and the rejected ones with their reason.
2. The report has confirmed issues, a flaky section with rates, an
   unverified section, and links to the bundles.
3. `haunt-ci` with a decider that files only false issues exits 0 on a clean
   page; with one true issue on a buggy page, exits 1.
4. The command prompt explains claims and names no tool the server lacks.

### E7 — the gate is not lying, and nothing regressed (R-E19, R-E20)

1. **Sabotage**, each of which must turn at least one test red: steps
   recorded by reference instead of locator; failed actions replayed;
   one replay taken as confirmation; flaky issues reported as confirmed;
   rejected issues reported; secrets left in the trace; screenshots not
   masked; the storage cap ignored; the issue's own session reused for the
   replay.
2. Every requirement id of this document is claimed by a gate test.
3. The part 1 and part 2 gates pass unchanged.
4. The recording overhead budget (R-E20), with the other time budgets.

## Accepted when

E1 to E7 are green on the three systems, the earlier gates still are, and a
live `/haunt-test` on `demo/` produces a report where every issue has a
bundle that replays.
