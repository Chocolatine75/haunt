# Report-quality benchmark — design

## Problem

There is no way to measure whether a change to haunt makes the reports it
produces *better* or *worse*. This session fixed a critical bug (the
accessibility tree was silently broken) and a long list of majors/minors, on
the strength of manual live testing — but "it seems to work now" isn't a
repeatable signal. We need a benchmark that:

1. Gives an objective score for a given haunt report against known-correct
   ground truth.
2. Is scriptable — rerunnable with one command, not a manually-driven Claude
   Code session, so it stays useful for every future change.
3. Also answers, once, historically: how much did this session's fixes
   actually improve report quality over the pre-fix state ("v1")?

## Ground truth

`demo/` already documents 6 intentionally-planted bugs in its README. One
(`lib/auth.ts` logging the password in plaintext) is only observable by
reading server logs — no browser-driven persona can find it. It's excluded
from the scored ground truth and called out explicitly as a documented
limitation, not silently dropped.

Ground truth lives at `demo/benchmark-ground-truth.json`, versioned, one
entry per browser-discoverable bug:

```json
{
  "id": "signup-empty-email",
  "route": "/signup",
  "description": "Signup accepts an empty email with no error message",
  "category": "ux"
}
```

5 entries: signup empty-email, dashboard unauthenticated access, admin
client-side-only role check, login double-submit, settings silent save.

## Components

All new code lives under `mcp-server/src/benchmark/`, following the same
patterns already established for `mcp-server/src/cli/`:

- **`ground-truth.ts`** — loads and types `demo/benchmark-ground-truth.json`.
- **`format-check.ts`** — pure, deterministic checker: does a report's
  frontmatter have the required fields (`haunt`, `target`, `date`, `personas`,
  `areas_tested`, `issues.*`, `top_fix`) and does the body have the required
  section headers (`## Issues`, `## Session Impressions`, `## For Claude`)?
  No LLM call — the format is code-generated (`generate-report.ts`), so this
  is checking code output against a known contract, not judging free text.
- **`judge.ts`** — the one part that needs semantic judgment: given the
  ground-truth list and a report's structured issues (from its JSON
  sidecar), which ground-truth bugs were found (recall), which reported
  issues don't correspond to any real bug (false positives — including
  tooling artifacts like a failed click reported as an app issue), and is
  each reported issue's fix recommendation concrete/actionable or vague.
  Implemented the same way `providers/anthropic.ts` and `providers/mistral.ts`
  implement `decideAction`: a forced tool call (`score_report`) returning
  structured JSON, one factory per provider (`createAnthropicJudge`,
  `createMistralJudge`), reusing `resolveProvider`/`ResolvedProvider` from
  `cli/headless.ts` for provider selection. Not merged into
  `providers/types.ts`'s `decide_action` machinery — different tool schema,
  different purpose, small enough that sharing would cost more clarity than
  it saves.
- **`run.ts`** — the CLI entrypoint (new tsup entry, `bin: "haunt-benchmark"`,
  mirroring `cli/headless.ts`'s bin wiring exactly): calls `runHeadlessTest`
  (imported directly from `cli/headless.ts` — no subprocess) against a target
  URL (default `http://localhost:3000`, override via arg) with the
  `confused-beginner` persona, runs `format-check` and the judge on the
  result, and prints/writes a scorecard (counts: recall N/5, false positives,
  actionable/total, format pass/fail — plus the full judge reasoning for
  transparency).

## What this session's v1-vs-v2 comparison does differently

v1 (commit `76f48ff`) has no headless mode — `haunt-ci` doesn't exist there.
For v1 only, I drive the interactive `commands/haunt-test.md` flow by hand
(as I've done for every other live check this session), against a v1
worktree with its Chromium version mismatch manually worked around (installing
the exact revision it expects) purely to unblock the run — not "fixing" v1,
just clearing the one obstacle unrelated to what we're measuring. I then
hand-transcribe v1's markdown-only issue list into the same `Issue[]` shape
`format-check`/`judge` expect, so **both** v1 and v2 go through the identical
scoring pipeline. v2's run uses the real `haunt-benchmark` script — no manual
transcription, dogfooding the actual tool being built.

The v1 pass is a one-time historical note, not part of the reusable
benchmark — nothing about v1 gets checked into the ground-truth/runner code.

## Cost

Every `haunt-benchmark` run costs one real LLM API call for the persona
loop (same as `haunt-ci`) plus one for the judge call. I will confirm before
running it for real (uses whichever provider key is available) and before
re-running it for the v1-vs-v2 comparison.

## Output

- `docs/benchmark.md` — methodology: what's measured, how to run it, how to
  read a scorecard, documented limitations (single persona, 4-area scouting
  cap, semantic judge is itself an LLM and can be wrong, the excluded
  server-log-only bug).
- This session's v1-vs-v2 result — presented as an artifact (scorecard +
  both full reports), not committed as repo content (it's a one-time
  historical finding, not a maintained fixture).

## Testing

- `format-check.test.ts` — pure function, straightforward unit tests
  (well-formed report passes; each required field/section missing fails
  independently).
- `judge.test.ts` (one per provider, matching `providers/*.test.ts`'s
  existing mocked-client pattern) — mocked client, verify the forced tool
  call shape and response parsing (matched/missed/false-positive/actionable
  extraction).
- No test attempts to assert on real LLM judgment quality — that's
  inherently non-deterministic and is exactly what a human reads the
  scorecard's reasoning field to sanity-check.
