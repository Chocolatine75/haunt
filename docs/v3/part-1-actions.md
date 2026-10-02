# Part 1 — element references and a full action set

Specification and acceptance gate for part 1 of the [roadmap](../ROADMAP.md).

**Target:** after this part, haunt acts on a web page at least as well as
browser-use does. Every action browser-use has, haunt has an equivalent for,
and it passes a harder test than browser-use publishes for its own.

**Why this part is first:** today an action is a sentence (`click Sign up`)
parsed by a regex and resolved by guessing among roles. It has four verbs, it
cannot scroll, a missed click costs 3 to 20 seconds, and a value containing
` in ` cannot be typed (see `HISTORY.md`, known weaknesses). Nothing built on
top of that can be reliable.

Requirements are numbered (`R1.2`) so that every gate test names the
requirement it proves, and every requirement has at least one gate test.

## Out of scope

Deciding *what* to do stays with the model. Screenshots as the primary
perception and coordinate clicks are part 4. HTTP, exception and
accessibility signals are part 2. Evidence bundles are part 3. This part
keeps today's behaviour for all three and must not regress it.

---

## A. The page snapshot

What the tester is shown before it decides. Returned by `haunt_capture_state`
and, in short form, by every action result.

- **R-A1 References.** Every element a user can act on gets a reference
  (`e1`, `e2`, …) shown in the snapshot. Acting on a reference acts on exactly
  that element. No name matching, no guessing.
- **R-A2 What counts as actionable.** Links, buttons, inputs, selects,
  textareas, `contenteditable`, elements with an interactive ARIA role,
  elements with an `onclick` attribute or `draggable="true"`, elements that
  set a pointer, grab or resize cursor, `tabindex >= 0`, `<summary>`, and
  scrollable containers. A listener added from script leaves no trace on the
  element, so it cannot be a criterion; the cursor usually is one. Labels are
  not listed (acting on a label is acting on its control), nor are elements
  hidden from assistive technology with `aria-hidden`. Disabled elements are
  listed and marked `disabled`, so the tester can report "the button is
  disabled" instead of failing on it. An element that is in the way of an
  actionable one is listed too, whatever it is, so that it can be named.
- **R-A3 Every tree.** References cover open shadow roots, closed shadow
  roots, same-origin iframes and cross-origin iframes (within the sandbox
  allowlist), nested to any depth. Each frame and shadow host is shown as a
  container so the tester sees the structure.
- **R-A4 What each line carries.** Role, accessible name, and when present:
  current value, placeholder, checked/selected/expanded state, `required`,
  `invalid`, input type, href, and `disabled`. Password values are never
  shown, only `(filled)`.
- **R-A5 Visibility is stated, not hidden.** Each element is marked when it is
  outside the viewport (`offscreen`) or covered by another element
  (`covered by e14`), or when it ignores the pointer (`pointer-events: none`).
  It stays listed: acting on it is allowed and fails with the real reason
  (section D). An element that is not rendered, invisible or of zero size is
  listed and marked hidden with the reason. Part 4 will later decide what the tester is
  *shown*; this part decides what is *true*.
- **R-A6 Scroll position.** The snapshot states how far the page and each
  scrollable container can scroll in each direction, in pixels and as a
  fraction (`1,240 px above · 3,900 px below`).
- **R-A7 Tabs and dialogs.** The snapshot lists open tabs with their index,
  title and URL, marks the active one, and states any open JavaScript dialog
  with its type and message.
- **R-A8 Stable references.** An element keeps its reference across snapshots
  for as long as it is the same DOM node. A node that is removed and
  re-created gets a new reference; the old one becomes stale forever and is
  never reused within the session.
- **R-A9 What changed.** Elements that appeared since the previous snapshot
  are marked `new`. The snapshot can be requested as a diff against the
  previous one (added, removed, changed lines only). A change in where an
  element is (scrolled out, covered) is reported on the element but is not a
  change of the page for the diff.
- **R-A10 Bounded size, nothing silently dropped.** The snapshot has a
  character budget. When a page exceeds it, the output is cut at an element
  boundary and says so (`412 more elements below — scroll or request
  page 2`), with a way to get the rest. Today's blind cut at 4,000
  characters goes.
- **R-A11 Scoping.** The snapshot can be limited to a region by reference
  (`within: e30`) and filtered to actionable elements only.
- **R-A12 Text content.** Non-interactive text (headings, paragraphs, error
  messages, table cells) is present in reading order, because that is what a
  tester reads to judge the page.
- **R-A13 Attributes on request.** The caller can name attributes to report
  for each element (`data-testid`, for instance). None are reported unless
  asked for.

The snapshot comes in two formats. `text` is what a model reads, with each
element's reference written `[e12]`, and is the one the size budget applies
to (12,000 characters a page). `json` is the same snapshot as data, never
paged, for callers that process it. The exact shape of both, and of every
action and result below, is fixed in `mcp-server/src/gates/part-1/contract.ts`.

## B. The actions

One tool, `haunt_act`, taking a structured action. Parameters are JSON, never
a sentence to parse. The right-hand column is the browser-use action it
matches or exceeds.

| Action | Parameters | Behaviour | browser-use |
|---|---|---|---|
| `click` | `ref`, `button?` (left/right/middle), `count?` (1–3), `modifiers?` | Scrolls into view, waits until actionable, clicks | `click` |
| `fill` | `ref`, `text`, `clear?` (default true), `submit?` | Sets the value of an input, textarea or `contenteditable` | `input` |
| `type` | `ref?`, `text`, `delay_ms?` | Key-by-key typing, for inputs with key handlers (autocomplete, masks) | `input` |
| `press` | `keys` (`Enter`, `Control+A`, a sequence), `ref?` | Key presses on the focused or given element | `send_keys` |
| `select` | `ref`, `values` (by label or value, one or many) | Native `<select>`, single or multiple | `select_dropdown` |
| `options` | `ref` | Lists the options of a native select or an opened custom listbox | `dropdown_options` |
| `check` | `ref`, `checked` | Sets a checkbox, radio or switch to a state (no-op if already there) | — |
| `hover` | `ref` | Moves the pointer over the element and holds | — |
| `scroll` | `direction`, `amount?` (pixels or pages), `ref?` (a container) | Scrolls the page or one container | `scroll` |
| `scroll_to` | `ref` or `text` | Brings an element or the first match of a text into view | `find_text` |
| `drag` | `from_ref`, `to_ref` and/or `offset` | Pointer drag with real intermediate moves. The offset is counted from the centre of `to_ref`, or of `from_ref` without one | — |
| `upload` | `ref`, `files` | Sets files on a file input, or on the one attached to the element (inside it, labelled by it, or the only one next to it), as with a hidden input behind a styled button | `upload_file` |
| `goto` | `url` | Navigates the active tab | `navigate` |
| `back` / `forward` / `reload` | — | History navigation and refresh | `go_back` |
| `wait_for` | `text?` / `ref?` / `gone?` / `url?` / `ms?`, `timeout_ms` | Waits for a condition, or a fixed time | `wait` |
| `tab` | `op` (switch/close/new), `index?`, `url?` | Tab management | `switch`, `close` |
| `dialog` | `accept`, `text?` | Answers an open `alert`, `confirm` or `prompt` | — |
| `resize` | `width`, `height` | Changes the viewport (responsive bugs) | — |
| `read` | `ref?` | Returns the full text of the page or of one region | `extract` |

Not carried over from browser-use, on purpose: `search` (a web search engine
has no place in testing one app), file read/write tools, and `evaluate`
(arbitrary JavaScript would let the tester do what no user can; it stays out
of the tester's hands).

- **R-B1** Every action in the table exists with those parameters.
- **R-B2 Actionability.** Before acting, the element must be attached,
  visible, stable (not animating), enabled, and the top element at the click
  point. The action waits for this up to a bounded time, then fails with the
  reason.
- **R-B3 Real input.** Clicks, hovers and drags are real pointer events at
  the element's position; typing produces real key events. A click must never
  be dispatched to a covered element by script, because that hides the exact
  bug class haunt exists to find.
- **R-B4 Text is data.** Any string is typed exactly: quotes, newlines, tabs,
  emoji, right-to-left text, markup, the word ` in `, 5,000 characters.
- **R-B5 Sequences.** `haunt_act` accepts a list of actions executed in
  order. Execution stops at the first failure, and also stops when an action
  changes the URL or opens a dialog or a tab, because the remaining
  references may no longer mean what the tester thought. The result says how
  many ran and why it stopped.
- **R-B6 Budget.** Each executed action counts as one step. The existing
  step limit, duration cap and idle reaping apply unchanged.

## C. What an action returns

- **R-C1 Outcome.** `ok` or a failure with a code from section D.
- **R-C2 What changed.** URL before and after; whether a navigation happened
  (a document load or any change of URL, `pushState` and hash included);
  tabs opened or closed; a dialog that appeared, with its message; a download
  that started, with its file name; whether focus moved; whether the DOM
  changed at all. An action that changed nothing says `no observable change`
  — for a tester that is often the finding. Focus moving to the control that
  was clicked does not count as a change.
- **R-C3 Fresh snapshot diff.** The result includes the snapshot diff
  (R-A9), so the tester rarely needs a separate capture call.
- **R-C4 Settling.** The result is produced once the page has finished
  reacting to the action: no request the action started is still in flight,
  no short timer it started is still pending, a frame has been drawn, and the
  DOM has been still for a moment. Activity that was already going on before
  the action (a clock, a polling loop) is not waited for. There is a hard cap
  of 5 seconds; if it is hit the result says the page was still busy and what
  was pending. A slow page must never look like a finished one, and must
  never hang the action.
- **R-C5 Timing.** Each result reports how long the action and the settling
  took.
- **R-C6 Existing fields kept.** Console errors, network errors, sandbox
  blocks, step and steps remaining, as today.

## D. Failures

A failure is information for the tester, so it is precise, fast, and never a
raw Playwright stack.

| Code | Meaning | Must include |
|---|---|---|
| `stale_ref` | The referenced node no longer exists | Whether a similar element now exists, and its new ref |
| `unknown_ref` | The ref was never issued | — |
| `covered` | Another element receives the click | The ref of the covering element |
| `disabled` | The element is disabled or `aria-disabled` | — |
| `not_visible` | Zero size, `display: none`, `visibility: hidden` | Which |
| `not_editable` | `fill`/`type` on something that takes no text | The element's role |
| `no_such_option` | `select` value not present | The available options |
| `not_a_file_input` | `upload` target takes no files | — |
| `dialog_open` | A dialog blocks the page | The dialog's type and message |
| `no_dialog` | `dialog` with nothing to answer | — |
| `timeout` | `wait_for` condition not met | What was observed instead |
| `navigation_failed` | The URL did not load | Status or network error |
| `sandbox_blocked` | Outside the allowlist | The blocked URL, without query string |
| `invalid_action` | Malformed parameters (reported like any other failed step, so a sequence says which action was wrong) | Which parameter |

- **R-D1** Every failure carries one of these codes and its required detail.
- **R-D2** A failure that can be known immediately (`unknown_ref`,
  `stale_ref`, `disabled`, `not_editable`, `invalid_action`, `no_dialog`)
  returns in under 200 ms. Any other failure returns in under 2 seconds
  unless the caller set a longer `timeout_ms`.
- **R-D3** A failed action never acts on a different element than the one
  referenced, and never leaves the page half-changed (a failed `fill` leaves
  the field as it was).
- **R-D4** `covered`, `disabled`, `no observable change` and
  `navigation_failed` are not auto-filed as app issues by the server. They
  are reported to the tester, who decides. (Today every failed action is
  filed as a major UX issue, which is the main source of false positives.)

## E. What must not regress

- **R-E1 Sandbox.** Every action, in every frame and tab, goes through the
  origin allowlist. A new tab opened by the page is sandboxed like the first.
- **R-E2 Redaction.** A value typed into a password field, or into a field
  whose name suggests a credential, never appears in a result, an issue, a
  log or a report: the snapshot shows `(filled)` in its place. Detection now
  uses the element (`type=password`, `autocomplete`) as well as its name.
- **R-E3 Callers updated.** `commands/haunt-test.md`, `haunt-ci`,
  `authenticate.ts` and the benchmark all use references and `haunt_act`.
  The sentence grammar and `haunt_navigate` are removed in the same release,
  with a version bump; nothing in the repo depends on them afterwards.
- **R-E4** All tests existing before this part still pass, except those of
  the removed grammar, which are replaced one for one.

## F. Performance

- **R-F1** Snapshot of a 2,000-element page: under 500 ms.
- **R-F2** A simple action on a settled page (click a button that changes
  text): under 300 ms including the result.
- **R-F3** 50 sequential actions on the 2,000-element page: under 30 seconds.
- **R-F4** Snapshot of the 2,000-element page fits its character budget, and
  the actionable-only snapshot is at most one third of the full one.

---

# The gate

Lives in `mcp-server/src/gates/part-1/`, one file per suite, and runs with
`npm run gate`. Each test is registered with the requirements it proves, and
`status.ts` lists the tests the implementation passes so far. A test that is
not listed runs as an expected failure: CI stays green while it fails and
turns red the moment it passes, which is the cue to list it. The part is
accepted when every test is listed. All of it is deterministic: scripted
actions through a real MCP client, a real Chromium, the gauntlet served on
`127.0.0.1`. No model is called.

## How a gate flow is written

A flow never hard-codes a reference. It finds one the way a tester would —
by reading the snapshot (`ref of the button named "Delete" in row 3`) — then
acts, then asserts on **the page's real state**, read independently through
Playwright, never on the tool's own report alone. A tool that says `ok`
while the page did not change must fail the gate.

Each gauntlet page exposes its ground truth on `window.__gauntlet` (which
handlers fired, in what order, with what values), so a test can tell "the
right element received a real click" from "something happened".

## The gauntlet pages for this part

| Page | Contains |
|---|---|
| `forms` | Every input type, labels by `for`, by wrapping, by `aria-labelledby`, and none at all; required and invalid states; a masked phone field; an autocomplete that reacts to keystrokes; a field that reformats on blur |
| `shadow` | A form inside an open shadow root, one inside a closed root, and a custom element nested three levels deep |
| `frames` | A same-origin iframe, a cross-origin iframe on an allowlisted origin, an iframe inside an iframe, and an iframe loaded 1 s late |
| `selects` | Native single and multiple selects, a custom listbox rendered in a portal, a combobox with async options, a select with 500 options |
| `overlays` | A modal with a backdrop, a cookie banner over the footer, a transparent full-page overlay, a sticky header covering a scrolled-to target, a toast that covers a button for 1.5 s |
| `hover` | A menu visible only on hover, a nested submenu, a tooltip that carries the only label of an icon button |
| `dnd` | A sortable list (pointer events), a HTML5 drag-and-drop board, a range slider, a resizable panel |
| `upload` | A plain file input, a hidden input behind a styled button, a drop zone, a multiple-file input with an `accept` filter |
| `scroll` | A 10,000 px page, an infinite list loading 20 items per scroll, a horizontally scrolling table, a scroll container inside a scroll container, a virtualised list of 5,000 rows |
| `tabs` | `target=_blank` links, `window.open` on click, a popup that closes itself |
| `dialogs` | `alert`, `confirm`, `prompt`, a `beforeunload` guard, and a dialog raised 500 ms after a click |
| `dupes` | Five identical "Delete" buttons in table rows, two forms with the same field names, three links named "Read more" |
| `dynamic` | A list that re-renders every node on each keystroke, a button replaced by an identical one after click, content that appears after 2 s, a button that moves while animating |
| `editor` | A `contenteditable` rich-text area, a code editor built on a hidden textarea, a canvas with one accessible button |
| `huge` | 2,000 interactive elements and 20,000 text nodes |
| `states` | A disabled button that enables after a valid form, `aria-disabled`, `pointer-events: none`, zero-size and `visibility: hidden` elements |
| `spa` | Client-side routing with `pushState`, a route that never settles (a polling request every 200 ms), a route that streams its content |
| `escape` | Eight ways of reaching another origin that the page never contacts while loading: links, a form post, `window.open`, `fetch`, a beacon, an image, an open redirect, and a frame doing the same |
| `login` | A login form behind a header link that reads exactly like its submit button; one valid set of credentials |

## Gate suites

### G1 — Snapshot truth (R-A1 … R-A12)

1. On every gauntlet page, every element in the page's own registry of
   actionable elements has exactly one reference, and no reference points to
   a non-actionable element. Checked exhaustively, not by sample.
2. Elements in closed shadow roots, nested iframes and the late-loading
   iframe are referenced, with their container shown.
3. For 40 chosen elements, the snapshot line carries the correct role, name,
   value and state; password values never appear.
4. Each element behind each of the five overlays is marked covered, with the
   reference of what covers it; when the overlay closes, the mark goes.
5. Scroll figures match the real `scrollTop`/`scrollHeight` to the pixel, for
   the page and for the nested containers.
6. References are stable across 20 consecutive snapshots of an unchanged
   page; after the `dynamic` list re-renders, old references are stale and
   are never issued again during the session.
7. The diff after an action lists exactly the added, removed and changed
   elements, compared with a diff the test computes itself from the DOM.
8. On `huge`, the snapshot stays within budget, ends at an element boundary,
   states the number of elements left, and paging through it returns every
   one of the 2,000 exactly once.

### G2 — Every action, on the hard case (R-B1 … R-B4)

One flow per row of the action table, each on the hardest gauntlet variant,
each asserting on `window.__gauntlet`:

1. `click`: the third of five identical "Delete" buttons removes row 3 and
   only row 3; right-click opens the context menu; double-click enters edit
   mode; control-click on a link opens a tab.
2. `fill` and `type`: all 14 input types take a valid value; the masked field
   and the keystroke autocomplete work with `type` and the test proves `fill`
   alone would not have triggered them; the field that reformats on blur ends
   with the reformatted value.
3. Text as data: 30 strings, including quotes, backslashes, newlines, tabs,
   emoji, combining characters, Arabic, a script tag, `sign in now`, an empty
   string and a 5,000-character string, each read back byte for byte. Plus a
   property test: 200 random Unicode strings round-trip.
4. `select` and `options`: single, multiple, by label and by value, the
   500-option select, the portal listbox, the async combobox.
5. `check`: checkbox, radio group, ARIA switch; setting the current state
   again fires no event.
6. `hover`: the nested submenu item is reached and clicked; the icon button
   is identified by its tooltip.
7. `drag`: the sortable list is reordered to a given order; a card moves
   between columns on the HTML5 board; the slider lands on value 73; the
   panel is resized to 400 px ± 2.
8. `upload`: one file, three files, the hidden input, the drop zone; the
   page reports the right names, sizes and contents; a file rejected by
   `accept` is reported as rejected by the page.
9. `scroll` and `scroll_to`: item 200 of the infinite list is reached and
   clicked; row 4,321 of the virtualised list is reached; the inner container
   scrolls without moving the outer one; the last column of the wide table
   is reached.
10. `tab`: both kinds of new tab are detected, switched to, acted in, closed,
    and focus returns; the self-closing popup is reported as closed.
11. `dialog`: each of the three types is reported with its message and
    answered; the `prompt` text reaches the page; the late dialog is
    reported by the action that caused it; `beforeunload` is handled.
12. `back`, `forward`, `reload`: correct on both full-page and `pushState`
    navigation, with form state checked after `back`.
13. `wait_for`: each condition type succeeds when met and times out with a
    description of what was observed when not.
14. `resize`: at 375 px the mobile menu button is referenced and the desktop
    navigation is not actionable.
15. `read`: returns the full text of a region, matching `innerText` after
    whitespace normalisation.
16. Shadow and frames: the full `forms` flow passes unchanged inside the
    closed shadow root and inside the nested iframe.

### G3 — Failures are exact and fast (R-D1 … R-D4, R-B2, R-B3)

1. Each of the 14 failure codes is produced by a dedicated case, with its
   required detail present and correct.
2. Each of the five overlays: clicking the element behind returns `covered`
   naming the right covering element, in under 2 s, and the page's registry
   proves the covered element's handler **did not fire**.
3. The toast case: the same click succeeds without the caller retrying,
   because the element becomes actionable within the wait.
4. The moving button is clicked once it stops; the click lands on it.
5. Stale: after the `dynamic` list re-renders, acting on an old reference
   returns `stale_ref` with the new reference of the equivalent element, and
   the registry proves nothing was clicked. Repeated 100 times with the
   re-render racing the action: never a click on the wrong node.
6. Immediate failures return in under 200 ms, measured over 50 runs, worst
   case counted.
7. A failed `fill` leaves the previous value intact.
8. No failure is filed as an app issue by the server.

### G4 — Results tell the truth (R-C1 … R-C6, R-B5)

1. For 25 actions with known effects, the reported changes (URL, navigation,
   tabs, dialog, download, focus, DOM changed) equal the observed ones.
2. A click on a button with no handler reports `no observable change`.
3. Settling: after a click that triggers a 1.5 s request then a re-render,
   the result already contains the re-rendered content. On the polling route
   the action returns within the cap and reports the page as still busy,
   naming the pending request. On the streaming route the result arrives
   within the cap.
4. Sequences: a ten-action form fill runs as one call; a sequence whose
   fourth action navigates stops after it and reports six not run; a
   sequence whose third action fails reports the failure and leaves the
   remaining ones unexecuted, proven by the registry.
5. Each executed action costs exactly one step; a sequence that would exceed
   the limit stops at the limit.

### G5 — Nothing regressed (R-E1 … R-E4)

1. Sandbox: a click on a cross-origin link, a form posting off-origin, a
   `window.open` to another origin, a fetch from inside an iframe, and a
   navigation inside a new tab are all blocked, recorded, and never received
   by the outside server.
2. Redaction: values typed into a `type=password` field with a misleading
   name ("Answer"), into an `autocomplete=current-password` field, and into
   a field named "Email" appear in no result, issue, report or log. The test
   searches every string the server returned and every file it wrote.
3. `haunt-ci` with a scripted decider completes the login flow and a
   three-step session using references only.
4. `authenticate` logs in on the gauntlet's login page, including when a
   decoy "Log in" link precedes the real submit button.
5. No reference to `haunt_navigate` or the sentence grammar remains in the
   repo; `distribution.test.ts` confirms command and server agree.

### G6 — Performance (R-F1 … R-F4)

Each budget measured over 10 runs on the CI machine, worst run counted.

### G7 — The gate is not lying

A gate that cannot fail proves nothing, so the gate is itself tested.

1. **Sabotage.** The gate ships with a list of deliberate breakages of the
   implementation, applied one at a time behind a test-only switch, each of
   which must make at least one gate test fail: dispatch clicks by script
   instead of real pointer events; resolve a stale reference by name;
   return before settling; skip the actionability check; drop elements in
   closed shadow roots; cut the snapshot mid-element; report `ok` on a
   covered click; reuse a reference number; skip redaction by element type;
   let a new tab bypass the sandbox. A sabotage that leaves the gate green
   is a hole in the gate and blocks acceptance until a test is added.
2. **No flakes.** The whole gate passes 20 times in a row on each of Linux,
   macOS and Windows, without retries (`npm run gate:soak`).
3. **Coverage.** Every requirement id in this document appears in at least
   one gate test name, checked by a script.

## Parity with browser-use

Not part of the CI gate (it needs a model), but run once before the part is
declared accepted and committed under `docs/benchmarks/part-1/`:

- The 16 flows of G2, described in plain language, are given to haunt and to
  browser-use with the same model and the same step budget, three runs each.
- **Acceptance:** haunt completes at least as many flows as browser-use on
  its worst run, and at least 14 of 16.
- Per flow: success, steps used, wall-clock time, tokens. Flows where
  browser-use succeeds and haunt fails are listed and each gets either a fix
  or a written reason before acceptance.

## Accepted when

G1 to G7 are green in CI on the three operating systems, the 232 earlier
tests (minus the replaced grammar tests) still pass, coverage thresholds
hold, `dist/` is rebuilt, and the parity run meets its threshold.
