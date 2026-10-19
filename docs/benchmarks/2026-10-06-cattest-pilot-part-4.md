# CATTest pilot, part 4: three measures

The same three applications as the [pilot of 5 October](2026-10-05-cattest-pilot.md)
(CATTest 2, 4 and 7), the same model, the URL and nothing else, one run each.
What changes is haunt: the tester of part 4 in place of the persona, measured
three times as it was built. Each measure was read in its logs, and what the
logs showed is what the next one fixed.

One run per application is not a score. A bug found or missed once can be
luck; the gate of part 4 (T8) asks for three runs and takes the worst.

## Results

Matched against CATTest's annotations by reading the reports.

| Annotated bug | Before part 4 | Roles (#54) | Iteration 1 (#55) | Iteration 2 (#56, #57) | Claude + Playwright MCP |
|---|---|---|---|---|---|
| 2: with the lightbox open, Tab reaches the page behind | no | no | found, then rejected | **yes** | no |
| 4: recipe cards jump on hover | no | no | no | no | no |
| 4: star ratings always show five | no | no | no | no | no |
| 7: "Titles only" also matches descriptions | no | **yes** | **yes** | **yes** | yes |
| **Found** | **0 / 4** | **1 / 4** | **1 / 4** | **2 / 4** | **1 / 4** |
| Issues in the reports | 1 | 2 | 2 | 4 | 8 |
| Cost per application | $0.29 | $0.93 | $0.87 | $0.64 | $0.42 |

Both bugs haunt reports were confirmed by three replays each and come with
an evidence bundle. Of the four issues of the last measure, the other two are
on the gallery (every photo has two "View" buttons; focus is not returned to
the card that opened the lightbox): real as far as the reports show, not in
CATTest's annotations, so false positives under its protocol.

## What each measure showed

**Roles.** The first run with a planner and testers found the search bug that
only plain Claude had found. It cost twice as much: the orchestrator alone
was a third of each run, eleven calls each carrying its whole context. On the
gallery the planner had planned "focus stays inside the lightbox", and the
tester checked that "2 / 12" was on the page and passed the case. On the
catalogue a tester lost its cases to "Quick View" being on every card.

**Iteration 1** asked testers for the claim itself as the expectation, gave a
way to check where the focus is, named same-named controls by their place,
and cut the orchestrator's calls. The tester on the gallery then found the
bug, and the report did not have it: it had proved the bug with a check that
held under the id of the case it had just failed, the case turned to passed,
and its issue was replayed against the wrong check and rejected. On the
catalogue two testers asked the planner's ended session for its plan, were
told "not found" and planned on their own; and the plan and the session's
end each weighed more than the host lets a tool return.

**Iteration 2** fixed those three. Two bugs of four, for less than the first
measure of part 4.

## What is still missed

Both bugs of the recipe catalogue, in the three measures. They are about what
the page shows, not about a control: cards that move when hovered, stars that
do not follow the score. The planner now looks at a screenshot of its area
and is asked for cases on what a page shows; on this page (86 controls) it
planned seven cases, none about either. The filters and the search of that
page pass their checks.

## Against the rule

Part 4's live gate: more annotated bugs than Claude with Playwright MCP, or
as many for less. The last measure has two against one, at $0.64 an
application against $0.42. That is one run each; the gate is not passed
until three runs say the same.

The text each run ended with and haunt's reports are in
[`cattest-pilot/part-4/`](cattest-pilot/part-4/); `haunt-p4`, `haunt-it1` and
`haunt-it2` are the three measures.
