# Haunt

A Claude Code plugin and MCP server that tests a web app the way a real user
would break it. Background, decisions and known weaknesses are in
[`docs/HISTORY.md`](docs/HISTORY.md) — read it before any non-trivial change.

## Workflow: every change goes through a pull request

`master` is what users install (`/plugin install haunt` reads it directly).
The v3 overhaul is built on the long-lived **`v2` branch**: every PR targets
`v2`, and `v2` is merged into `master` only once the overhaul works as a
whole (see `docs/ROADMAP.md`), in a single PR the repo owner decides on.

1. **Never commit on `master` or `v2`, and never push to them directly.**
   Create a branch from `v2` before the first edit:
   `git checkout -b <type>/<short-topic> origin/v2` with type `feat`, `fix`, `test`,
   `docs`, `refactor`, `build` or `chore`.
2. **One topic per branch.** An unrelated fix found along the way gets its own
   branch and PR, or is written down in the PR description as a follow-up.
3. **Commit messages** follow the existing style: `type: what changed`, lower
   case, imperative, with a body that explains why when it is not obvious.
4. **Before pushing, run `npm run check` in `mcp-server/`** (lint, typecheck,
   tests with coverage, build). Do not open a PR with a failing check, and do
   not say a change works without having run it.
5. **Open the PR with `gh pr create --base v2`.** Never open a PR against
   `master` unless asked to. The description says
   what changed, why, and how it was verified (commands run and their result).
6. **Do not merge your own PR without being asked.** The repo owner merges, or
   asks for the merge explicitly. No force-push to a branch that has an open
   PR unless asked.
7. **CI must be green** on Linux, macOS and Windows before a merge.

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
| `npm run check` | Everything CI runs, in order |
| `npm test` | Tests once (about 40 s; needs Chromium: `npx playwright install chromium`) |
| `npx vitest run src/tools/navigate.test.ts` | One file |
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
  `mcp-server/src/server.ts`, `commands/haunt-test.md`). Change all of them
  together; `scripts/check-versions.mjs` fails otherwise.
- **`commands/haunt-test.md` is code.** It is the orchestration prompt. A tool
  renamed or added in `server.ts` must be reflected there, and the reverse.
- **Tool input schemas are hand-written JSON in `server.ts`**, separate from
  the TypeScript input types in `src/tools/`. Keep both in step.
- **Credentials must never reach a report, a log or an issue description.**
  `navigate.ts` redacts password and email fills; keep that property when
  touching anything that turns an action into text.
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
