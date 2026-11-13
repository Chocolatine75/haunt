# CATTest bench

Haunt measured on applications of CATTest (`Aisaka013/CATTest` on Hugging
Face, arXiv 2609.00081): AI-generated web apps with hand-annotated bugs.
`apps.json` lists the twelve used so far: the pilot (2, 4, 7) and the nine of
6 October (8, 22, 24, 27, 30, 41, 43, 46, 49), all static. Every run is kept
under `runs/<label>/`, so that a later one can be compared with it.

```
./fetch.py                      # apps and annotations into ~/.cache/haunt-bench/cattest
./serve.sh                      # each on 127.0.0.1:41NN; ./serve.sh stop
HAUNT=<checkout> ./run.sh <label> <app> [model]
./summary.py <label>            # runs/<label>/summary.md
```

`HAUNT` is the checkout whose plugin is measured; a worktree keeps it apart
from the one being edited. Label a run by date, model and what changed:
`2026-10-19-sonnet-part4`.

Each `runs/<label>/<app>/` holds what `collect.py` kept: `result.json` (cost,
time, model, haunt's branch and commit), `report.md` and `report.json`,
`metrics.json` (per agent: calls and characters per tool, context per turn in
tokens; actions used, cases, times held back) and `trace.txt` (every call, in
order). Which annotated bugs a report found is read by hand into
`runs/<label>/score.md`: the annotations are sentences, and the reports are
too.

Costs of a run of the twelve: about $6 with Sonnet. Keep the Mac awake and
plugged in: a run that sleeps passes haunt's 15-minute cap and measures
nothing. Opus spends a session's usage fast: one application at a time.

One run per application is not a score: on 6 and 7 October two runs of the
same nine applications found 5 of 23 bugs each, not the same five.

## When a change is better

A measure is **three runs** of the twelve applications with the same haunt
commit, model and flags, each under its own label (`<label>-r1`, `-r2`,
`-r3`). Each run is read twice, by hand until scoring is automatic:

- `score.md`: which annotated bugs the report names, confirmed or by hand.
- `entries.md`: every entry of the report, marked annotated, real, false,
  doubtful, environment or duplicate (see the reference's for the meaning).

From these, per measure:

| Number | What it is |
|---|---|
| found | annotated bugs found, mean of the three runs |
| stable | annotated bugs found in at least two of the three runs |
| confirmed | of `found`, those confirmed rather than by hand |
| false | false entries, mean of the three runs |
| noise | environment and duplicate entries, mean of the three runs |
| cost | dollars for the twelve, mean of the three runs |

A change is kept when, against the measure it changes:

1. `found` rises by at least 2, or `stable` by at least 1, **and**
2. `false` does not rise by more than 1, **and**
3. `cost` does not rise by more than a quarter.

A change that finds the same and lowers `false`, `noise` or `cost` is kept
too: it is the same tester, cheaper or easier to trust. Anything else is
not called better, whatever a single run showed. The margins are what one
version's runs differ by: the three reference runs found 6, 7 and 8.

## The reference

Part 4 as merged into `v2` (haunt 7680ba0), Sonnet, no `--spec`: runs
`2026-10-19-sonnet-part4` (r1), `2026-11-12-sonnet-part4-r2` and `-r3`.

| Number | r1 | r2 | r3 | Measure |
|---|---|---|---|---|
| found | 6 | 7 | 8 | **7.0** |
| stable | | | | **8** |
| confirmed | 3 | 4 | 6 | **4.3** |
| false | 7 | 5 | 5 | **5.7** |
| noise | 33 | 162 | 138 | **111** |
| cost | $4.29 | $4.84 | $4.57 | **$4.57** |

Nine annotated bugs were found at least once: 7#1, 8#1, 30#2 and 46#1 in
all three runs, 2#1, 22#4, 24#2 and 49#1 in two, 27#2 in one. Eighteen
never were, among them every bug of apps 4, 41 and 43. Haunt finds a third
of the annotated bugs, and each run catches about three quarters of what
it can catch.

Noise swings with third-party hosts: in r2 and r3, 123 of app 2's entries
are its gallery images from a host that hung. It says nothing about haunt
from one run to the next until those are grouped (#109).

With 27 annotated bugs only large effects show. More applications
(issue #74) make smaller ones visible.
