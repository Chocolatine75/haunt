# Every entry of "2026-10-19-sonnet-part4", true or not

`score.md` counts the annotated bugs a report found. This page reads the
other side: every entry of the twelve reports (issues, "To check by hand",
engine signals), and whether it is true. CATTest's annotations are not a
full list of an application's bugs, so an entry that matches none is not
false for that: each was checked against the application's source in
`~/.cache/haunt-bench/cattest/<id>/src` and its `project_doc.md`.

- **annotated**: names an annotated bug (counted in `score.md`).
- **real**: a true defect CATTest did not annotate.
- **false**: the application does not behave as the entry says.
- **doubtful**: could not be settled from the source alone.
- **environment**: about the bench, not the application (third-party hosts).
- **duplicate**: the same thing as another entry of the same report.

| App | Section | Entry | Verdict | Why |
|---|---|---|---|---|
| 2 | issue, confirmed | Lightbox does not trap focus | annotated | 2#1 |
| 4 | issue, confirmed | Quick View does nothing | real | The button is rendered with no handler (`index.html:1209`) |
| 4 | signal, layout | A recipe card covered by another card's "13 ingredients" | doubtful | Cards are placed by `translate()` with a transition; read at step 4, possibly mid-animation |
| 4 | signal, layout | "Time" covered by "Easy" | doubtful | Read during the 375 px check, before or after the masonry relaid out |
| 4 | signal, layout | Page 857 px wider than the window at 375 px | doubtful | The masonry relays out 150 ms after a resize (`index.html:1379`); the reading may come before it |
| 7 | issue, confirmed | "Titles only" matches descriptions | annotated | 7#1 |
| 7 | issue, confirmed | Contrast on 31 elements | real | axe |
| 7 | signal, a11y | Contrast | duplicate | Same as the issue |
| 8 | issue, confirmed | Sidebar list not reachable by keyboard | real | axe, and the items are plain elements |
| 8 | signal, a11y | Scrollable region without keyboard access | duplicate | Same as the issue |
| 8 | signal, layout ×3 | A brewery marker covered by the marker layer or a popup | false | Map markers overlap one another and a popup by nature of a map |
| 8 | signal, layout | "Zoom in" covered by "Toggle brewery list" | annotated | 8#1 |
| 8 | signal, layout | Toggle and Zoom in overlap | duplicate | Same as 8#1 |
| 8 | signal, http ×20 | Map tiles answered 429 | environment | OpenStreetMap's tile server limiting the bench, one entry per tile |
| 22 | | (nothing reported) | | |
| 24 | issue, confirmed | Six icon-only call buttons have no accessible name | real | axe |
| 24 | by hand | "Stop Sharing" covered while sharing | annotated | 24#2 |
| 24 | signal, a11y | Buttons without text | duplicate | Same as the issue |
| 27 | issue, confirmed | Share gives no feedback | false | `sharePoll` shows a "Link copied!" toast on success and on failure (`app.js:558`); the clipboard call likely never settles in headless Chromium |
| 27 | issue, confirmed | Empty name on "Join the Debate" does nothing | doubtful | Ignored on purpose (`app.js:807`); the spec does not ask for a message |
| 27 | issue, confirmed | Empty question on "Ask" does nothing | doubtful | Same, `app.js:593` |
| 27 | issue, confirmed | The same user can upvote a question again (12, 13, 14) | doubtful | Upvotes toggle per user name (`app.js:631`); the tester had renamed itself in between, so it voted as a new user |
| 27 | signal, a11y | Contrast, one element | real | axe |
| 27 | signal, dead control ×2 | "Join the Debate", "Ask" changed nothing | duplicate | Same as the two issues |
| 30 | by hand | Empty dialog after reading a one-read secret | annotated | 30#2 |
| 30 | signal, a11y | Contrast | real | axe |
| 41 | issue, confirmed | "Pre-Order Now" does nothing | **false** | It shows "Added to Cart ✓" for 2 s (`main.js:474`). haunt settled for 2,039 ms, then compared the page with the one before: the text was back. The replay did the same, so it was confirmed 3 of 3 |
| 41 | by hand | Loader text faintly visible behind the hero | doubtful | |
| 41 | signal, a11y | Contrast | real | axe |
| 43 | issue, confirmed | "Begin Your Journey" contrast | real | axe |
| 43 | by hand | "Download Expedition Guide" does nothing visible | **false** | It reads "Downloading…" then "Download Complete ✓" over 3.5 s (`index.html:1011`): the same blind spot as 41 |
| 43 | signal, http ×3 | A video answered 403 | environment | Third-party video host |
| 43 | signal, hung ×2 | A video got no answer | environment | Same host |
| 43 | signal, a11y | Contrast | duplicate | Same as the issue |
| 46 | by hand | Padlock and check mark shown together | annotated | 46#1 |
| 46 | by hand | Scratch card did not reveal its prize | doubtful | The tester itself suspected the simulated input |
| 46 | signal, layout | "Your Prizes" covered by the prizes panel | false | The panel opens over its own toggle and has its own close button (`index.html:797`) |
| 49 | issue, confirmed | Contrast on 3 elements | real | axe |
| 49 | signal, a11y | Contrast | duplicate | Same as the issue |

## Count

Rows above stand for 63 entries (the ×N rows count N).

| Verdict | Entries |
|---|---|
| annotated | 6 (one of them a signal) |
| real | 9: 7 axe findings (contrast, missing names) and 2 behaviours (4 Quick View, 8 keyboard list) |
| false | 7: two "does nothing" while the app gave feedback (41, 43), Share (27), four layout signals (8 ×3, 46) |
| doubtful | 8 |
| environment | 25 |
| duplicate | 8 |

What this says:

- **Most of a report is noise**: 25 of 63 entries are third-party hosts
  answering the bench, one per request, and 8 repeat another entry.
- **"Confirmed" does not mean true.** Two of the 13 confirmed issues are
  false (41 Pre-Order, 27 Share) and three more doubtful (27). A replay repeats the same blind spot as
  the first try.
- **The blind spot is transient feedback.** A message or label shown for
  a second or two and then put back is not seen, because the page is
  compared once it has settled. An application that confirms a click
  briefly is reported as dead.
- Beyond the annotated bugs, what haunt adds that is true is mostly axe
  (contrast, missing names) and two behaviours.
