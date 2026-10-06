# Part 5, first slice: layout defects as signals

Specification and gate for the first slice of part 5 of the
[roadmap](../ROADMAP.md): the visual checks geometry alone can make. The rest
of part 5 (a snapshot bounded to the window, annotated screenshots, checks
that need pixels) is not specified here.

**Target:** a control a user cannot reach because another sits on it, two
controls on top of each other, text that leaves its box, a dialog that opens
where the user is not looking, a page wider than a phone: the engine reports
each as a signal, without a model and without a screenshot, and reports
nothing on what only looks like one.

**Why:** the 190 bugs annotated in CATTest were read and sorted by what it
takes to find them
([`benchmarks/2026-10-06-cattest-pilot-part-4.md`](../benchmarks/2026-10-06-cattest-pilot-part-4.md)).
About a seventh are of this kind: a "Stop sharing" button under a control
bar, zoom controls over the layer settings, a payment dialog centred on the
page instead of the window, a button whose text overflows, a header that
makes a phone scroll sideways. After part 4 haunt reports none of them, and
neither did plain Claude with a browser on the pilot. They are facts of
geometry: nothing has to be judged, so nothing has to be asked of a model.

The hard part is not to see them, it is not to see them everywhere. A sticky
header covers the content that scrolls under it. A menu covers the page it
opens over. A title is cut with an ellipsis on purpose. Each rule is as
narrow as it takes to stay quiet on those, and the gate holds it to that on
every page of the gauntlet.

Requirements are numbered (`R-L1`); every gate test names the ones it proves.

## Out of scope

Anything that needs pixels: contrast as rendered, an image that is the wrong
one, a card that jumps when hovered, colours that do not follow their data.
A message that covers something for a moment (a toast) is not reported.
Reading the layout at a second, narrow width without being asked is left for
a later slice: here a narrow window is read when a tester makes it narrow.

---

## A. The rules

- **R-L1 Covered.** A control that is shown, enabled and in the window, at
  whose centre another element is what a click would land on, is reported
  (`covered`, major) when no scrolling would uncover it: both are pinned to
  the window, or both move with the page, or the page does not scroll. The
  signal names the control and what covers it.
- **R-L2 Overlap.** Two controls whose boxes share at least half of the
  smaller one, neither inside the other, are reported once (`overlap`,
  minor), naming both.
- **R-L3 Text that leaves its box.** Text wider or taller than the box that
  holds it is reported (`text_overflow`, minor) when it spills out of a box
  that has a border or a background of its own, or when the box cuts it and
  no ellipsis says so. It names the control, or quotes the text.
- **R-L4 A dialog outside the window.** A modal dialog less than six tenths
  of which is in the window when it is shown is reported
  (`dialog_outside_viewport`, major).
- **R-L5 A page wider than a narrow window.** At 600 px or less, a page
  that scrolls sideways is reported (`page_overflow`, minor) with by how
  much.
- **R-L6 Read when it may have changed.** The layout is read when a page is
  first reached in a session, and after an action that left it with more or
  fewer controls a user can see (a dialog that opens, a panel that closes) or
  changed the size of the window, on the page as the action left it, in the
  main frame. Not after every action: on a page of two
  thousand controls the reading is half an action's time, and part 2's
  budget for what signals may add to an action (R-S25) holds. Not after a
  hover. A signal carries the step that brought it (0 for the load).

## B. What is not a defect

- **R-L7 Quiet on what only looks like one.** None of these raises a
  signal: content under a sticky or fixed header that scrolling brings out;
  the page behind an open dialog, menu, listbox or tooltip, or behind a layer
  that takes more than three tenths of the window; a message shown for a
  moment (a status, an alert, a live region); what a hover brought; a control
  scrolled out of its list; text shortened with an ellipsis; a region that
  scrolls; text hidden from the eye and kept for a screen reader; words that
  wrap in a line; a badge on the corner of a button; a table wider than a
  wide window.

## C. Where it goes

- **R-L8 A signal like the others.** A layout defect is a signal of kind
  `layout` with its `rule`: delivered with the action that brought it, kept
  in the session's result, replayed and listed in the report under "Detected
  automatically". It is raised once however many readings find it again. A
  major one fails `haunt-ci`, as any major signal does.
- **R-L9 The gate is not lying.** With the layout left unread on purpose,
  the gate's check of a planted defect fails; every requirement here is
  claimed by a gate test; none is skipped.

---

## The gauntlet's layout pages

Each in `?variant=buggy` and `?variant=clean`, listed in
`test-support/gauntlet/layout-truth.json`, with beside each defect the
look-alikes of R-L7 in both variants.

| Page | Planted | Beside it, not to be reported |
|---|---|---|
| `lay-covered` | "Stop sharing" under a control bar, both pinned to the window | A sticky header, a menu that opens over the page, a backdrop without the role of a dialog, a status message |
| `lay-overlap` | Two zoom buttons on top of each other | Links that wrap in a sentence, a badge on a button's corner |
| `lay-text` | A label wider than its button; a price cut by its box | A title with an ellipsis, a log that scrolls, a link for screen readers only |
| `lay-dialog` | A payment dialog centred on the page, a screen and a half down | |
| `lay-narrow` | A header 620 px wide whatever the window | A table wider than a wide window |

## Gate suites

### L1 — each defect, and nothing beside it (R-L1 … R-L7)

1. On each page's buggy variant, exactly the signals of the ground truth: as
   it loads, and once its steps are played, each once, with its control, its
   severity and its step.
2. On each page's clean variant, the same steps raise nothing.

### L2 — silence everywhere else (R-L7)

1. No other page of the gauntlet, in either variant, raises a layout signal
   as it loads.
2. The one page of part 1 that plants a cover raises that cover and no
   other; the same page under a modal raises none.

### L3 — where it goes (R-L8)

1. A defect is one signal however many actions follow, and is in the
   session's result.
2. The report lists it under "Detected automatically"; a covered control
   counts as a confirmed major signal.

### L4 — the gate is not lying (R-L9)

1. With the layout left unread, the check of a planted defect fails.
2. Every requirement is claimed by a gate test, and none is skipped.

## Accepted when

L1 to L4 are green on Linux and macOS and the earlier gates still are.
