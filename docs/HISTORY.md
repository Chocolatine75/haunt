# Haunt — what has been built so far

A record of the project from its first commit (2026-04-10) to the start of the
`feat/v3-foundation` branch (2026-10-02): what exists, why it looks the way it
does, what was learned, and what is known to be weak. Written so that work can
resume after a long pause without re-reading 136 commits.

For how to work in this repo, see [`CLAUDE.md`](../CLAUDE.md).

## What haunt is today

A Claude Code plugin. `/haunt:haunt-test <url>` makes the host Claude session
roleplay a persona (a confused beginner, an adversarial user, a keyboard-only
user) and drive a real Chromium through seven MCP tools, then writes a ranked
bug report with a "For Claude" section meant to be pasted back as a fix prompt.

```
commands/haunt-test.md      the orchestration prompt (phases 0 → 3)
personas/*.yaml             3 built-in personas (system prompt, viewport, step budget)
.claude-plugin/             plugin + marketplace manifests
mcp-server/
  start.cjs                 launcher: Node check, Chromium install at the vendored revision
  src/engine/               drives the browser, knows nothing about MCP:
                            spawn, navigate, capture, get-cookies, end-session,
                            session/ (in-memory sessions, idle reaping),
                            persona/ (YAML + zod), report/ (estimate, generate)
  src/mcp/                  MCP server; tools.ts defines the 7 tools as zod schemas
  src/cli/                  haunt-ci: the same loop without Claude Code (Anthropic or Mistral)
  src/benchmark/            haunt-benchmark: scores a report against planted bugs
  dist/                     committed bundle + vendored Playwright (zero npm install for users)
demo/                       Next.js app with intentional bugs, the benchmark target
```

The seven tools:

| Tool | Does |
|---|---|
| `haunt_spawn` | Launches Chromium for a persona, loads the URL, builds the sandbox allowlist |
| `haunt_capture_state` | The page snapshot: every actionable element with a stable reference, in reading order with the page text; optional screenshot |
| `haunt_act` | Runs structured actions on references (click, fill, type, select, hover, drag, upload, tab, dialog…), with real input, and reports what each changed |
| `haunt_get_cookies` | Exports cookies so a login can be reused by other sessions |
| `haunt_end_session` | Closes the browser, returns issues and blocked requests |
| `haunt_estimate_cost` | Browser-call estimate printed before a run |
| `haunt_generate_report` | Counts, sorts, renders and writes the report, plus a JSON sidecar for `--compare` |

## Timeline

### April 10 — MVP in a day

Design spec (first called "phantom-users"), then types, `SessionManager`,
persona loader, the tools, a markdown reporter, the plugin layer and a first
README. The first `haunt_navigate` ran its own loop with Stagehand and Haiku.

The same day that was removed (`f5f4734`): the host Claude plays the persona
itself and the server only executes Playwright actions. This is the decision
that shaped everything since. It means no API key and no extra cost for the
interactive command, and it means the server has no intelligence of its own.

The rest of the day was packaging pain, each fixed in its own commit:
`CLAUDE_PLUGIN_ROOT` instead of `PLUGIN_DIR`, dependencies bundled with tsup,
Playwright's JS vendored into `dist/node_modules`, Chromium installed on first
run.

### April 11–12 — speed, output, auth, demo app

- Performance: no screenshots by default, 3 steps, a 4-area cap, all tool calls
  of one kind batched in a single message.
- Several rounds of terminal art (ANSI ghosts, a haunted house) were added and
  then removed in favour of plain text.
- Report gained YAML frontmatter, the likely-file heuristic and "For Claude".
- Personas were rewritten around corner cases instead of happy paths.
- Route discovery from real links in the DOM, replacing guessed routes.
- `--email/--password` login with cookie reuse, `--debug-auth`.
- Cost estimate and confirmation before spawning browsers.
- `haunt-target` (now `demo/`): a Next.js 14 + NextAuth + Prisma app with six
  intentional bugs. Merged as PR #1, the only PR the repo has had.

### April 15–20 — publish

Silent by default with `--verbose`, MIT licence, `docs/cli.md`, README rewrite,
Windows support (`start.sh` → `start.cjs`), `.mcp.json` untracked.

### September 4 — audit and hardening

After a pause, an audit produced a long run of fixes:

- The accessibility tree capture was broken (`page.accessibility` was removed
  from Playwright); replaced with `locator.ariaSnapshot()`.
- Chromium revision mismatch between `npx playwright` and the vendored runtime.
- Credentials could reach a written report; redaction added.
- Lint and typecheck did not pass; CI added (Linux, macOS, Windows).
- `max_steps` enforced server-side; idle sessions reaped after 10 minutes.
- First real tests for the action parser, spawn, capture and end-session.
- Report logic moved out of the prompt into `haunt_generate_report`.
- `haunt-ci` added, with Anthropic then Mistral as providers.
- `--routes` and `--compare`.
- `haunt-benchmark`: recall, false positives, actionability and format
  compliance against `demo/benchmark-ground-truth.json`, with an LLM judge
  whose verdicts are reconciled against the real ground-truth ids because the
  judge invented ids.

### September 7–8 — the experiment, and v2 sub-project 1

A black-box experiment asked whether haunt finds anything that Claude reading
the source would not:

- Round 1, the five original planted bugs: a code-review agent with no browser
  found all five plus eight more real ones in about two minutes with no false
  positives. Haunt's best was four of five, with false positives on every run.
- Round 2, three bugs built to be invisible in source (a hydration timing race,
  a CSS overlay intercepting clicks, a request that never resolves): the code
  reviewer found two, haunt found all three.

The conclusion written into the v2 spec: haunt's defensible value is bugs that
exist only at runtime. The v2 "harness program" was designed around that, as
five sub-projects in order:

| # | Sub-project | Status |
|---|---|---|
| 1 | Sandboxing | **Done** |
| 2 | Perception-bounded actor (stop giving the persona the full tree) | Not started |
| 3 | Investigation loop (hypothesis queue, `--deep`) | Not started |
| 4 | Verification and confidence scores | Not started |
| 5 | Continuous eval against runtime-only ground truth | Not started |

What sub-project 1 delivered: an origin allowlist captured during the target's
own initial load and frozen at `load`; later requests to any other origin are
aborted before they leave the browser; redirects are resolved by hand so an
allowlisted origin cannot bounce the session elsewhere; blocked URLs are
logged without their query string; blocks are reported separately and never
as app issues; a 15-minute active-duration cap; email values redacted like
passwords.

The specs and plans for all of this are in `docs/v2/`.

### October 2 — this branch

- 124 → 232 tests, coverage 73% → 90% of statements, with thresholds enforced
  in CI. See "Tests" below.
- **Bug found by the new tests and fixed:** `haunt-ci` had been a silent no-op
  since the benchmark was added on September 4. tsup moved `cli/headless.ts`
  into a shared chunk once `benchmark/run.ts` imported it, so its
  "am I the main module" check compared the chunk's URL with `dist/cli.js` and
  was always false. `haunt-ci <url>` printed nothing and exited 0, which a CI
  pipeline reads as a pass. Entrypoints are now separate `bin.ts` files that
  nothing imports.

### October 2 — part 1 of the v3 roadmap

Element references and a full action set, built gate-first (see
[`ROADMAP.md`](ROADMAP.md) and [`v3/part-1-actions.md`](v3/part-1-actions.md)):

- The gauntlet, a hostile 19-page app each page of which keeps its own record
  of what really happened to it.
- A gate of 246 tests written before the code, run as expected failures until
  each group passed, and tested itself by ten deliberate breakages of the
  engine.
- `haunt_capture_state` returns a reference snapshot through closed shadow
  roots and frames of any origin; `haunt_act` replaces `haunt_navigate` and
  its regex grammar with 21 structured actions, real pointer and keyboard
  input, 14 failure codes, and results that say what changed once the page
  has settled.
- `/haunt-test`, `haunt-ci` and the login helper moved to references. Version
  0.2.0.

This removed several weaknesses listed below as they stood in September:
slow failures (a missed click now fails in under two seconds with the
reason), the regex grammar and its four verbs, errors arriving one step late,
failed actions filed as app bugs, and the browser `haunt-ci` leaked when its
decider threw.

## Decisions worth remembering

- **The host LLM is the brain.** The server executes; it does not decide. Only
  `haunt-ci` and `haunt-benchmark` call an LLM API themselves.
- **`dist/` and Playwright are committed.** About 14 MB, accepted so that
  installing the plugin needs no `npm install`. A stale `dist/` has shipped
  more than once; `distribution.test.ts` now fails when its tool list differs
  from `src/`.
- **Deterministic work belongs in code, not in the prompt.** Counting, sorting,
  report rendering and cost estimates were moved out of `haunt-test.md`.
- **A real boundary beats an instruction.** The sandbox blocks requests; it
  does not ask the model to stay on target.
- **Versions are duplicated in five files** and checked by
  `scripts/check-versions.mjs` rather than unified.

## Known weaknesses

Carried over from the v2 spec:

- The persona sees the whole accessibility tree, so it cannot fail to notice
  something the way a person would.
- UX findings are unverified claims with no evidence requirement.
- The loop is a fixed number of steps with no follow-up on anything suspicious.
- On logic bugs, reading the code is faster and more accurate than haunt.

Still true after part 1:

- **`likelyFile` assumes the Next.js App Router** and is wrong elsewhere.
- **`--compare` matches issues by page, category and severity**, so two
  different issues on one page can be counted as the same.
- **Reports are named by date and persona**, so a second run on the same day
  overwrites the first.
- **The sandbox buffers each response before handing it to the page**, so a
  streamed response arrives all at once.
- **`upload` needs a file input it can find** (the element, one inside it, its
  label's, or the only one nearby). A button that creates its input when
  clicked is not handled.
- **A cover in the parent page over an iframe is not detected** for elements
  inside that iframe.
- `haunt-ci`'s default Anthropic model id (`claude-opus-5` in
  `cli/headless.ts`) should be checked against current model ids.

## Tests

Run from `mcp-server/`. `npm run check` runs everything CI runs.

| Layer | Files | What it proves |
|---|---|---|
| Unit | `engine/session/`, `engine/persona/`, `engine/screenshots`, `engine/report/`, `engine/end-session`, `engine/get-cookies`, `cli/providers/`, `benchmark/` | Pure logic with mocks |
| Tool, real browser | `engine/capture.test.ts`, `engine/spawn.test.ts`, `engine/spawn-session.test.ts`, `cli/authenticate.test.ts` | Tools against real pages: session setup, sandbox blocks, login |
| Gate | `gates/part-1/` on `test-support/gauntlet/` | The roadmap's acceptance tests: snapshot, every action, every failure, results, regressions, performance, and the gate itself |
| Protocol | `mcp/server.test.ts` | Tool list, schemas, argument validation, error results, through a real MCP client |
| End to end | `e2e/mcp-flow.test.ts`, `e2e/headless-flow.test.ts` | A whole session against a real HTTP app, over MCP and through the `haunt-ci` loop with a scripted decider |
| Distribution | `distribution.test.ts` | The committed `dist/` boots over stdio, matches `src/`, the CLIs exit with the right codes, manifests, command prompt and docs agree |

Not covered: a run with a real LLM (the benchmark does that, by hand, and
costs tokens), `start.cjs`'s Chromium install, and the `demo/` app.

## Next

The v3 plan, with the test gate each part must pass to be accepted, is in
[`ROADMAP.md`](ROADMAP.md). It supersedes v2 sub-projects 2 to 5, whose ideas
(bounded perception, verification, continuous eval) it carries over.
