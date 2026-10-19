# Score of "2026-10-19-sonnet-part4"

Read by hand: which of CATTest's annotated bugs each report names, and where.
"Confirmed" is an issue or a signal the engine replayed; "by hand" is under
"To check by hand". The reference for the runs that follow: part 4 as merged
into `v2` (one tester per area, the sweep, the hold-back), Sonnet, no `--spec`.

| App | Annotated | Found | Which, and where |
|---|---|---|---|
| 2 | 1 | 1 | Tab leaves the lightbox: confirmed issue |
| 4 | 2 | 0 | |
| 7 | 1 | 1 | "Titles only" matches descriptions: confirmed issue |
| 8 | 1 | 1 | Zoom in covered by the list toggle at 375 px: layout signal |
| 22 | 4 | 0 | |
| 24 | 5 | 1 | "Stop sharing" covered by the control bar: by hand |
| 27 | 2 | 0 | |
| 30 | 3 | 1 | Blank dialog once a secret burns: by hand |
| 41 | 1 | 0 | |
| 43 | 1 | 0 | |
| 46 | 2 | 1 | Padlock and check mark shown together: by hand |
| 49 | 4 | 0 | |
| **Total** | **27** | **7** | 3 confirmed, 4 by hand |

The same as the runs of 6 and 7 October (5 of 23 on the nine, 2 of 4 on the
pilot), with not quite the same bugs: 22#4, 30#1 and 49#1 were found then
and not now; 24#2 and 30#2 now and not in the first of them.

What the table of `summary.md` adds: testers used 8 to 38 of their 60
actions, and reached 30 000 to 87 000 tokens of context. Of what the tools
returned to them, `haunt_act` is the largest share on most applications
(up to 86 000 characters on app 4), then the inventory of `haunt_plan`.
