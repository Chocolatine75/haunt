# Haunt

A Claude Code plugin and MCP server that tests a web app the way a real user
would break it. Background, decisions and known weaknesses are in
[`docs/HISTORY.md`](docs/HISTORY.md) — read it before any non-trivial change.

## Workflow: every change goes through a pull request

`master` is what users install (`/plugin install haunt` reads it directly).
The v3 overhaul is built on the long-lived **`v2` branch**, and `v2` is merged
into `master` only once the overhaul works as a whole (see `docs/ROADMAP.md`),
in a single PR the repo owner decides on.

Work on a roadmap part happens at two levels:

- **One part branch per roadmap part** (`part-1/actions`), with one PR open
  against `v2` for the whole part.
- **Sub-PRs against the part branch** (`part-1/gauntlet` → `part-1/actions`),
  one topic each, each linked from the part's PR.

A change that is not part of a roadmap part (a fix, docs, CI) goes straight
to `v2` in its own PR.

**CI runs macOS only on every pull request.** Linux, macOS and Windows all
run on a push to `v2` or `master`, that is, when a PR is merged there. So a
Linux- or Windows-only failure shows up on `v2` after the merge: check the
run on `v2` after every merge, and fix a red `v2` before anything else.

1. **Never commit on `master` or `v2`, and never push to them directly.**
   Nor directly on a part branch once its PR is open. Create a branch from
   the part branch (or from `v2` for work outside a part) before the first
   edit: `git checkout -b <type>/<short-topic> origin/v2` with type `feat`, `fix`, `test`,
   `docs`, `refactor`, `build` or `chore`.
2. **One topic per branch.** An unrelated fix found along the way gets its own
   branch and PR, or is written down in the PR description as a follow-up.
3. **Commit messages** follow the existing style: `type: what changed`, lower
   case, imperative, with a body that explains why when it is not obvious.
4. **Before pushing, run `npm run check` in `mcp-server/`** (lint, typecheck,
   build, tests with coverage). Do not open a PR with a failing check, and do
   not say a change works without having run it.
5. **Open the PR with `gh pr create --base <part branch>`** for a sub-PR, or
   `--base v2` for a part's PR and for work outside a part. Never open a PR
   against `master` unless asked to.
6. **Do not merge your own PR without being asked.** The repo owner merges, or
   asks for the merge explicitly. No force-push to a branch that has an open
   PR unless asked.
7. **CI must be green before a merge**, and the full run on `v2` must be
   green after it.

### Pull request descriptions

Write them the way a developer would in a hurry: a few plain sentences saying
what changed and why, and one line on how it was checked. No headings, no
tables, no bold, no bullet lists unless there really are several separate
things, no emoji, no "generated with" footer. If it takes more than a short
paragraph or two, the PR is too big or the text is padding. The title is the
commit-style summary.

These rules hold even for a one-line change and even when asked to "just push
it" in passing — say that the repo works by PR and open one.

## Tests are part of the change

- A bug fix comes with a test that fails without the fix.
- A new tool, flag, action verb or report field comes with tests at the level
  where it can break: unit for logic, a real browser for anything touching
  Playwright, `server.test.ts` or `e2e/` for anything a host can observe.
- Coverage thresholds in `mcp-server/vitest.config.ts` are a floor. Raise them
  when coverage goes up; never lower them to get a PR through.
- Tests use a real Chromium and real HTTP servers (`src/test-support/`), not
  mocks of Playwright. Mock only the LLM providers.
- No test may call a paid API or reach the network beyond `127.0.0.1`.
- Never weaken or delete a test to make it pass. If a test is wrong, say why
  in the PR.

## Roadmap parts are accepted by their gate, nothing else

The goal is to be measurably better at QA-testing web apps than browser-use.
[`docs/ROADMAP.md`](docs/ROADMAP.md) splits that into parts, and each part has
a gate: a set of deliberately hard tests in `mcp-server/src/gates/`.

- Write the gate tests first and see them fail before implementing the part.
- A part is done only when its whole gate passes in CI on all three OSes,
  without retries, and every earlier gate still passes.
- Never weaken a gate to get a part through: no skipping, no loosened
  assertion, no raised timeout. If a gate test is wrong, fix it in its own PR
  and say why.
- Do not describe a part as done, or claim haunt beats another tool, on any
  basis other than the gate results. Report what passed and what did not.

## Commands

All from `mcp-server/`:

| Command | Does |
|---|---|
| `npm run check` | Lint, typecheck, rebuild `dist/`, then tests with coverage (the tests check `dist/`, so it is built first) |
| `npm test` | Tests once (about 40 s; needs Chromium: `npx playwright install chromium`) |
| `npx vitest run src/engine/spawn.test.ts` | One file |
| `npm run gate` | The roadmap gates only; `npm run gate:soak` runs them 20 times |
| `npm run test:coverage` | Tests with the coverage thresholds |
| `npm run lint` / `npx biome check --write src` | Check / fix formatting and lint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Rebuild `dist/` and re-vendor Playwright |

From the repo root: `node scripts/check-versions.mjs`.

## Things that will bite you

- **`dist/` is committed and is what users run.** Any change under
  `mcp-server/src/` that affects runtime behaviour needs `npm run build` and
  the resulting `dist/` in the same PR. `distribution.test.ts` catches a tool
  list that differs from `src/`, not every stale bundle.
- **CLI entrypoints live in `bin.ts` files that nothing imports.** Do not put
  an "is this the main module" check in a module that other code imports;
  tsup moves shared modules into chunks and the check silently stops working.
- **The version string is in five places** (`.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `mcp-server/package.json`,
  `mcp-server/src/mcp/server.ts`, `commands/haunt-test.md`). Change all of them
  together; `scripts/check-versions.mjs` fails otherwise.
- **`commands/haunt-test.md` is code.** It is the orchestration prompt. A tool
  renamed or added in `src/mcp/tools.ts` must be reflected there, and the reverse.
- **`src/engine/` must not import from `src/mcp/`.** The engine drives the
  browser and knows nothing about MCP; `mcp/`, `cli/` and `benchmark/` are
  three callers of it.
- **A tool's input is defined once, as a zod schema in `src/mcp/tools.ts`.**
  The JSON Schema hosts see and the argument validation both come from it.
  Do not hand-write JSON Schema, and do not cast arguments past the schema.
- **Credentials must never reach a report, a log or a tool result.** The
  snapshot reports credential fields as `(filled)` and action results never
  echo what was typed; keep that property when touching anything that turns
  page state or an action into text.
- **Code that runs in the page is serialised with `toString()`**
  (`snapshot/page-script.ts`, `act/page-fns.ts`): each function must be
  self-contained, with no import and no reference outside its own body.
- **Clicks, hovers, drags and keystrokes are real input**, never dispatched
  by script. A scripted click goes through an overlay; a user's does not, and
  finding that is the point.
- **A sandbox block is not an app bug.** Blocked requests go to
  `sandbox_blocked_requests`, never to `network_errors` or `issues`.
- **`malicious-user` sends real attack payloads.** Only run it against
  `demo/` or an app the user owns.
- Reports and screenshots are written to `.haunt-reports/` in the current
  directory. It is gitignored; tests clean up what they write.

## Style

TypeScript, ESM, Biome (2 spaces, single quotes). Comments explain why a thing
is the way it is, often with the failure that led to it — keep that habit and
do not narrate what the code does. Prefer a real boundary in code over an
instruction in a prompt, and deterministic work in code over asking the model
to do it.
