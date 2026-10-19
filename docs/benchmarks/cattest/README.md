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
