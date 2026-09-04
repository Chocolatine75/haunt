# Report-quality benchmark

`haunt-benchmark` scores a haunt report against a known set of bugs planted
in `demo/`, so a change to haunt's tools or prompts can be checked for a
report-quality regression with one command instead of manual live testing.

## What it measures

Against `demo/benchmark-ground-truth.json` (5 bugs, one per browser-
discoverable entry in `demo/README.md`'s "Known intentional bugs" list):

- **Recall** — how many of the 5 ground-truth bugs a run's report actually
  found (matched by an LLM judge call, not exact-string matching — issue
  descriptions are free text and reword between runs).
- **False positives** — reported issues that don't correspond to any real,
  known bug, including tooling artifacts (e.g. a failed click misreported as
  an app issue rather than a parser limitation).
- **Actionability** — how many reported issues (matched or not) have a
  concrete, actionable fix recommendation vs. a vague one.
- **Format compliance** — deterministic, no LLM involved: does the report
  have the required frontmatter fields and section headers from
  `tools/generate-report.ts`'s documented contract?

## Running it

```bash
# from the repo root, with the demo app running at localhost:3000
export ANTHROPIC_API_KEY=sk-ant-...   # or MISTRAL_API_KEY
node mcp-server/dist/benchmark.js
```

Or, once installed as a package: `npx --package @haunt/mcp-server haunt-benchmark`.

Flags: `[url]` (default `http://localhost:3000`), `--ground-truth <path>`
(default `demo/benchmark-ground-truth.json`, resolved relative to the
working directory), `--provider anthropic|mistral`, `--model <id>`,
`--out <path>` (also write the scorecard as JSON).

**Cost:** real LLM calls every run — one per persona-loop step (3, by default) plus one for the judge call, so 4 total with the defaults.

## Reading a scorecard

```
----------------------------------------
target: http://localhost:3000
report: .haunt-reports/2026-09-04-confused-beginner.md
recall: 3/5
missed: admin-client-side-role-check, settings-silent-save
false positives: 1
actionable: 4/6
format: ok

judge reasoning:
<one paragraph explaining the scoring>
----------------------------------------
```

Always read the `judge reasoning` field — the judge is itself an LLM call
and can misjudge a match. The scorecard is a strong signal, not ground truth
about ground truth.

## Known limitations

- **Single persona, single run.** `confused-beginner` only, one pass — no
  averaging across personas or repeated runs to smooth out LLM
  non-determinism. A single low/high score can be noise, not signal.
- **Tests one URL only.** Unlike the interactive `/haunt-test` command,
  `haunt-benchmark` does not do Phase 1 route discovery — it tests exactly
  the URL you give it. If ground-truth bugs live on other routes, point
  separate runs at them explicitly (or pass a different `[url]`).
- **The judge is an LLM, not an oracle.** Semantic matching between free-text
  issue descriptions and ground-truth bugs is exactly the kind of judgment
  call that can be wrong in either direction — a real match missed, or a
  coincidental phrase wrongly counted as one.
- **`lib/auth.ts`'s password-logging bug is excluded by construction.** It
  only shows up in server logs — no browser-driven persona can find it, so
  it was never included in the scored ground truth. Max achievable recall
  against `demo/`'s full bug list is 5/6, not 6/6.
- **Same model judges itself.** The model deciding persona actions and the
  model judging the report are the same (`--provider`/`--model` apply to
  both) — a form of self-evaluation bias. A future `--judge-model` flag
  could decouple them; for now, treat cross-model comparisons (e.g.
  Anthropic vs. Mistral) with extra scrutiny since the judge changes along
  with the model under test.
