# Report-Quality Benchmark Implementation Plan


**Goal:** Build `haunt-benchmark`, a scriptable CLI that runs haunt against the demo app, scores the resulting report against a versioned ground-truth list of known bugs (recall, false positives, fix actionability, format compliance), and prints/saves a scorecard — so any future change to haunt can be checked for report-quality regression with one command instead of manual live testing.

**Architecture:** New `mcp-server/src/benchmark/` module reusing `cli/headless.ts`'s existing machinery (`runHeadlessTest`, `resolveProvider`, `createDecider`) to produce the report, then adding a "judge" LLM call (same forced-tool-call pattern as `decideAction`, one factory per provider under `benchmark/judge/`) to semantically score reported issues against ground truth, plus a pure deterministic format checker. Ships as a third tsup entry (`dist/benchmark.js`, bin `haunt-benchmark`), mirroring `dist/cli.js`'s existing wiring exactly.

**Tech Stack:** TypeScript, Vitest, tsup, `@anthropic-ai/sdk`, `@mistralai/mistralai` (both already dependencies — no new packages).

**Spec:** `docs/v2/specs/2026-09-04-report-quality-benchmark-design.md`

## Global Constraints

- Node >=18 (already enforced repo-wide via `mcp-server/package.json`'s `engines`).
- No new npm dependencies — `@anthropic-ai/sdk` and `@mistralai/mistralai` are already installed.
- Every new CLI-adjacent file follows the existing `cli/headless.ts` / `cli/providers/*` patterns exactly (forced tool-call shape, `Pick<...>`-typed option params, injectable dependencies for testability, `isMainModule` guard).
- `demo/benchmark-ground-truth.json` is the only ground truth — 5 entries, one per browser-discoverable bug from `demo/README.md`'s "Known intentional bugs" list, excluding the `lib/auth.ts` password-logging bug (not observable via browser automation).
- No live LLM API calls in this plan's automated tests — all provider-level tests use mocked SDK clients (matching `cli/providers/*.test.ts`). A real, money-spending run of the finished tool happens only after this plan is fully implemented and the user has separately confirmed it.

---

## File Structure

```
mcp-server/src/is-main-module.ts                 (new, shared — extracted from cli/headless.ts)
mcp-server/src/is-main-module.test.ts             (new)
mcp-server/src/cli/headless.ts                    (modified — use the shared isMainModule)

demo/benchmark-ground-truth.json                  (new — ground truth data)
mcp-server/src/benchmark/ground-truth.ts          (new — loader + types)
mcp-server/src/benchmark/ground-truth.test.ts     (new)
mcp-server/src/benchmark/__fixtures__/ground-truth.json  (new — test fixture, 2 entries)

mcp-server/src/benchmark/format-check.ts          (new — deterministic report format checker)
mcp-server/src/benchmark/format-check.test.ts     (new)

mcp-server/src/benchmark/judge/types.ts           (new — ReportJudge type, tool schema, shared parse fn)
mcp-server/src/benchmark/judge/anthropic.ts       (new)
mcp-server/src/benchmark/judge/anthropic.test.ts  (new)
mcp-server/src/benchmark/judge/mistral.ts         (new)
mcp-server/src/benchmark/judge/mistral.test.ts    (new)

mcp-server/src/benchmark/run.ts                   (new — CLI entrypoint)
mcp-server/src/benchmark/run.test.ts              (new)

mcp-server/tsup.config.ts                         (modified — third entry)
mcp-server/package.json                           (modified — bin entry)
mcp-server/scripts/vendor-playwright.mjs          (modified — also chmod dist/benchmark.js)

docs/benchmark.md                                 (new — methodology write-up)
```

---

### Task 1: Extract shared `isMainModule` utility

`cli/headless.ts` already has a hand-rolled `isMainModule()` that fixes a real bug (symlinked install paths silently no-op'ing the CLI, found and fixed this session in commit `0929899`). `benchmark/run.ts` needs the exact same guard. Duplicating it risks the fix drifting out of sync in one copy — extract it once, shared.

**Files:**
- Create: `mcp-server/src/is-main-module.ts`
- Create: `mcp-server/src/is-main-module.test.ts`
- Modify: `mcp-server/src/cli/headless.ts:1-18,316-337` (imports + the guard at the bottom)

**Interfaces:**
- Produces: `isMainModule(moduleUrl: string): boolean` — exported from `mcp-server/src/is-main-module.ts`. Callers pass their own `import.meta.url`.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/src/is-main-module.test.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isMainModule } from './is-main-module.js';

describe('isMainModule', () => {
  it('returns true when moduleUrl resolves to the same file as process.argv[1]', () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = fileURLToPath(import.meta.url);
    try {
      expect(isMainModule(import.meta.url)).toBe(true);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('returns false when moduleUrl does not match process.argv[1]', () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = '/definitely/not/this/file.js';
    try {
      expect(isMainModule(import.meta.url)).toBe(false);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('returns false instead of throwing when process.argv[1] is unset', () => {
    const originalArgv1 = process.argv[1];
    // @ts-expect-error — simulating an environment where argv[1] is missing
    process.argv[1] = undefined;
    try {
      expect(isMainModule(import.meta.url)).toBe(false);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/is-main-module.test.ts`
Expected: FAIL — `Cannot find module './is-main-module.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/is-main-module.ts`:

```ts
// mcp-server/src/is-main-module.ts
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// True when the module at moduleUrl is the one Node was invoked with directly
// (`node file.js`), false when it was imported (e.g. by a test). Resolves
// symlinks on both sides before comparing — a raw
// `moduleUrl === file://${process.argv[1]}` string comparison breaks under any
// symlink in the invocation path (e.g. macOS's /tmp -> /private/tmp):
// import.meta.url resolves through it, argv[1] doesn't, so they silently never
// match and the caller's entrypoint never runs — exit 0, no output, no error,
// the worst failure mode for a CI tool. Found and fixed for cli/headless.ts in
// commit 0929899; shared here so benchmark/run.ts doesn't reintroduce it.
export function isMainModule(moduleUrl: string): boolean {
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/is-main-module.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Refactor `cli/headless.ts` to use the shared utility**

In `mcp-server/src/cli/headless.ts`, change the import block (currently lines 16-18):

```ts
import 'dotenv/config';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
```

to:

```ts
import 'dotenv/config';
import { isMainModule } from '../is-main-module.js';
```

Then replace the bottom of the file (currently):

```ts
// Only auto-run when executed directly (not when imported by tests). Comparing
// raw import.meta.url to process.argv[1] breaks under any symlink in the path
// (e.g. macOS's /tmp -> /private/tmp) — import.meta.url resolves through it,
// argv[1] doesn't, so the strings never match and main() silently never runs:
// exit 0, no output, no error — the worst failure mode for a CI tool. Resolve
// both sides with realpathSync first so a symlinked install path still works.
function isMainModule(): boolean {
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
```

with:

```ts
// Only auto-run when executed directly (not when imported by tests) — see
// is-main-module.ts for why this can't be a raw string comparison.
if (isMainModule(import.meta.url)) {
  main();
}
```

- [ ] **Step 6: Run the full existing test suite and typecheck to confirm nothing broke**

Run: `cd mcp-server && npm run typecheck && npx vitest run src/cli/headless.test.ts`
Expected: typecheck passes with no errors; `headless.test.ts` — all 16 tests still pass (this file imports from `headless.js` but never calls `main()` directly, so the refactor is invisible to it).

- [ ] **Step 7: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/is-main-module.ts mcp-server/src/is-main-module.test.ts mcp-server/src/cli/headless.ts
git commit -m "$(cat <<'EOF'
refactor: extract isMainModule into a shared utility

cli/headless.ts had a hand-rolled realpath-based isMainModule() fixing
a real bug (symlinked install paths silently no-op'ing the CLI, fixed
in 0929899). benchmark/run.ts needs the identical guard — sharing it
once means the fix can't drift out of sync between two copies.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 2: Ground-truth data and loader

**Files:**
- Create: `demo/benchmark-ground-truth.json`
- Create: `mcp-server/src/benchmark/ground-truth.ts`
- Create: `mcp-server/src/benchmark/ground-truth.test.ts`
- Create: `mcp-server/src/benchmark/__fixtures__/ground-truth.json`

**Interfaces:**
- Consumes: `IssueCategory` from `mcp-server/src/types.ts` (existing: `'ux' | 'accessibility' | 'performance' | 'security' | 'content'`).
- Produces: `GroundTruthBug` interface and `loadGroundTruth(path: string): GroundTruthBug[]`, both exported from `mcp-server/src/benchmark/ground-truth.ts`. Later tasks (`run.ts`, `judge/*`) import both from here.

- [ ] **Step 1: Create the real ground-truth data**

Create `demo/benchmark-ground-truth.json` (5 entries, matching `demo/README.md`'s "Known intentional bugs" list minus the server-log-only password bug):

```json
[
  {
    "id": "signup-empty-email",
    "route": "/signup",
    "description": "Signup accepts an empty email with no error message",
    "category": "ux"
  },
  {
    "id": "dashboard-unauthenticated-access",
    "route": "/dashboard",
    "description": "Dashboard loads for unauthenticated users because middleware doesn't protect it",
    "category": "security"
  },
  {
    "id": "admin-client-side-role-check",
    "route": "/admin",
    "description": "Admin role check is client-side only and can be bypassed",
    "category": "security"
  },
  {
    "id": "login-double-submit",
    "route": "/login",
    "description": "Login allows double-submit because the button isn't disabled during the async request",
    "category": "ux"
  },
  {
    "id": "settings-silent-save",
    "route": "/settings",
    "description": "Settings save shows no success or error feedback",
    "category": "ux"
  }
]
```

- [ ] **Step 2: Create the test fixture (small, separate from the real data)**

Create `mcp-server/src/benchmark/__fixtures__/ground-truth.json`:

```json
[
  {
    "id": "test-bug-one",
    "route": "/foo",
    "description": "Something breaks on /foo",
    "category": "ux"
  },
  {
    "id": "test-bug-two",
    "route": "/bar",
    "description": "Something breaks on /bar",
    "category": "security"
  }
]
```

- [ ] **Step 3: Write the failing test**

Create `mcp-server/src/benchmark/ground-truth.test.ts`:

```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadGroundTruth } from './ground-truth.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = resolve(__dirname, '__fixtures__/ground-truth.json');

describe('loadGroundTruth', () => {
  it('loads and parses a ground-truth JSON file', () => {
    const bugs = loadGroundTruth(FIXTURE);
    expect(bugs).toHaveLength(2);
    expect(bugs[0]).toEqual({
      id: 'test-bug-one',
      route: '/foo',
      description: 'Something breaks on /foo',
      category: 'ux',
    });
  });

  it('throws a clear error when the file does not contain a JSON array', () => {
    expect(() => loadGroundTruth(resolve(__dirname, 'ground-truth.ts'))).toThrow();
  });

  it('throws when the file does not exist', () => {
    expect(() => loadGroundTruth('/no/such/file.json')).toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/benchmark/ground-truth.test.ts`
Expected: FAIL — `Cannot find module './ground-truth.js'`

- [ ] **Step 5: Write the implementation**

Create `mcp-server/src/benchmark/ground-truth.ts`:

```ts
// mcp-server/src/benchmark/ground-truth.ts
import { readFileSync } from 'node:fs';
import type { IssueCategory } from '../types.js';

export interface GroundTruthBug {
  id: string;
  route: string;
  description: string;
  category: IssueCategory;
}

export function loadGroundTruth(path: string): GroundTruthBug[] {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} does not contain a JSON array of ground-truth bugs`);
  }
  return parsed as GroundTruthBug[];
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/benchmark/ground-truth.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/matt/dev/haunt
git add demo/benchmark-ground-truth.json mcp-server/src/benchmark/ground-truth.ts mcp-server/src/benchmark/ground-truth.test.ts mcp-server/src/benchmark/__fixtures__/ground-truth.json
git commit -m "$(cat <<'EOF'
feat: add benchmark ground-truth data and loader

5 entries, one per browser-discoverable bug from demo/README.md's
"Known intentional bugs" list — excludes the lib/auth.ts password
logging bug, which only shows up in server logs and can't be found by
a browser-driven persona.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 3: Deterministic report format checker

**Files:**
- Create: `mcp-server/src/benchmark/format-check.ts`
- Create: `mcp-server/src/benchmark/format-check.test.ts`

**Interfaces:**
- Produces: `FormatCheckResult` interface and `checkReportFormat(markdown: string): FormatCheckResult`, exported from `mcp-server/src/benchmark/format-check.ts`. Consumed by `run.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `mcp-server/src/benchmark/format-check.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkReportFormat } from './format-check.js';

const WELL_FORMED_REPORT = `---
haunt: true
target: http://localhost:3000
date: 2026-01-01
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
top_fix: "Fix it"
---

# Haunt Report — http://localhost:3000

## Issues

### 1. [MAJOR] Something is broken

## Session Impressions

**/x — Confused Beginner:** "Confusing."

## For Claude

1. [MAJOR] \`/x\` — Fix it.
`;

describe('checkReportFormat', () => {
  it('passes a well-formed report with no missing pieces', () => {
    const result = checkReportFormat(WELL_FORMED_REPORT);
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it('flags a missing frontmatter block entirely', () => {
    const withoutFrontmatter = WELL_FORMED_REPORT.replace(/^---[\s\S]*?---\n\n/, '');
    const result = checkReportFormat(withoutFrontmatter);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('frontmatter block (--- ... ---)');
  });

  it('flags a missing individual frontmatter field', () => {
    const withoutTopFix = WELL_FORMED_REPORT.replace('top_fix: "Fix it"\n', '');
    const result = checkReportFormat(withoutTopFix);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('frontmatter field "top_fix:"');
  });

  it('flags each missing required section header independently', () => {
    const withoutForClaude = WELL_FORMED_REPORT.replace(
      /## For Claude[\s\S]*/,
      '',
    );
    const result = checkReportFormat(withoutForClaude);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('section "## For Claude"');
    // Issues and Session Impressions are still present
    expect(result.missing).not.toContain('section "## Issues"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/benchmark/format-check.test.ts`
Expected: FAIL — `Cannot find module './format-check.js'`

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/benchmark/format-check.ts`:

```ts
// mcp-server/src/benchmark/format-check.ts
//
// The report format is code-generated (tools/generate-report.ts), not
// LLM-authored — so checking it against the documented contract is a
// mechanical string check, not a judgment call. No LLM call here.

export interface FormatCheckResult {
  ok: boolean;
  missing: string[];
}

const REQUIRED_FRONTMATTER_FIELDS = [
  'haunt:',
  'target:',
  'date:',
  'personas:',
  'areas_tested:',
  'issues:',
  'top_fix:',
];

const REQUIRED_SECTION_HEADERS = [
  '## Issues',
  '## Session Impressions',
  '## For Claude',
];

export function checkReportFormat(markdown: string): FormatCheckResult {
  const missing: string[] = [];

  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    missing.push('frontmatter block (--- ... ---)');
  } else {
    const frontmatter = frontmatterMatch[1];
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      if (!frontmatter.includes(field)) {
        missing.push(`frontmatter field "${field}"`);
      }
    }
  }

  for (const header of REQUIRED_SECTION_HEADERS) {
    if (!markdown.includes(header)) {
      missing.push(`section "${header}"`);
    }
  }

  return { ok: missing.length === 0, missing };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/benchmark/format-check.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/benchmark/format-check.ts mcp-server/src/benchmark/format-check.test.ts
git commit -m "$(cat <<'EOF'
feat: add deterministic report format checker for the benchmark

Pure string check against generate-report.ts's documented contract
(required frontmatter fields, required section headers) — no LLM call,
since the format is code-generated, not free text to judge.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 4: Judge shared types and tool schema

**Files:**
- Create: `mcp-server/src/benchmark/judge/types.ts`

**Interfaces:**
- Consumes: `Issue` from `../../types.js`, `GroundTruthBug` from `../ground-truth.js`.
- Produces: `JudgeVerdict`, `ReportJudge` type, `SCORE_REPORT_TOOL_NAME`, `SCORE_REPORT_TOOL_DESCRIPTION`, `scoreReportParameters()`, `buildJudgePrompt()`, `parseScoreReportInput()` — all exported, consumed by `judge/anthropic.ts` and `judge/mistral.ts` (Tasks 5-6).

No standalone test for this file — it's schema/type plumbing exercised indirectly by `judge/anthropic.test.ts` and `judge/mistral.test.ts`, exactly like `cli/providers/types.ts` has no dedicated test file of its own.

- [ ] **Step 1: Write the implementation**

Create `mcp-server/src/benchmark/judge/types.ts`:

```ts
// mcp-server/src/benchmark/judge/types.ts
import type { Issue } from '../../types.js';
import type { GroundTruthBug } from '../ground-truth.js';

export interface JudgeMatch {
  ground_truth_id: string;
  matched_issue_description: string;
}

export interface JudgeVerdict {
  matched: JudgeMatch[];
  missed_ground_truth_ids: string[];
  false_positives: Array<{ description: string; reason: string }>;
  actionable_count: number;
  reasoning: string;
}

// One call: given the ground-truth bugs and a report's reported issues, score
// the report. Mirrors cli/providers/types.ts's ActionDecider shape.
export type ReportJudge = (
  groundTruth: GroundTruthBug[],
  issues: Issue[],
) => Promise<JudgeVerdict>;

export const SCORE_REPORT_TOOL_NAME = 'score_report';

export const SCORE_REPORT_TOOL_DESCRIPTION =
  'Score a haunt bug report against a list of known, ground-truth bugs: which ground-truth bugs a reported issue actually corresponds to, which reported issues are false positives (including tooling artifacts — e.g. a failed click misreported as an app bug, not a real product issue), and how many of the reported issues have a concrete, actionable fix recommendation rather than a vague one.';

export function scoreReportParameters(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      matched: {
        type: 'array',
        description:
          'Ground-truth bugs that a reported issue actually corresponds to',
        items: {
          type: 'object',
          properties: {
            ground_truth_id: { type: 'string' },
            matched_issue_description: {
              type: 'string',
              description:
                'The description of the reported issue that matches this ground-truth bug',
            },
          },
          required: ['ground_truth_id', 'matched_issue_description'],
        },
      },
      missed_ground_truth_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'IDs of ground-truth bugs that no reported issue corresponds to',
      },
      false_positives: {
        type: 'array',
        description:
          'Reported issues that do not correspond to any real, ground-truth bug',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['description', 'reason'],
        },
      },
      actionable_count: {
        type: 'number',
        description:
          'How many of the TOTAL reported issues (not just matched ones) have a concrete, actionable fix recommendation',
      },
      reasoning: {
        type: 'string',
        description:
          'One paragraph explaining the scoring, for a human to sanity-check',
      },
    },
    required: [
      'matched',
      'missed_ground_truth_ids',
      'false_positives',
      'actionable_count',
      'reasoning',
    ],
  };
}

export function buildJudgePrompt(
  groundTruth: GroundTruthBug[],
  issues: Issue[],
): string {
  return [
    'Ground-truth bugs known to exist in the app:',
    JSON.stringify(groundTruth, null, 2),
    '',
    'Issues reported in the haunt test report being scored:',
    JSON.stringify(issues, null, 2),
    '',
    'Score this report by calling score_report.',
  ].join('\n');
}

export function parseScoreReportInput(input: unknown): JudgeVerdict {
  const parsed = input as Partial<JudgeVerdict>;
  if (
    !Array.isArray(parsed.matched) ||
    !Array.isArray(parsed.missed_ground_truth_ids) ||
    !Array.isArray(parsed.false_positives) ||
    typeof parsed.actionable_count !== 'number' ||
    typeof parsed.reasoning !== 'string'
  ) {
    throw new Error(
      `${SCORE_REPORT_TOOL_NAME} tool call was missing one or more required fields`,
    );
  }
  return {
    matched: parsed.matched,
    missed_ground_truth_ids: parsed.missed_ground_truth_ids,
    false_positives: parsed.false_positives,
    actionable_count: parsed.actionable_count,
    reasoning: parsed.reasoning,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npm run typecheck`
Expected: passes with no errors (this file has no test of its own; typecheck is the verification for this task).

- [ ] **Step 3: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/benchmark/judge/types.ts
git commit -m "$(cat <<'EOF'
feat: add shared judge types and score_report tool schema

Mirrors cli/providers/types.ts's decide_action pattern: one forced
tool call, one JSON Schema shared across providers, one parse function.
No standalone test — exercised via judge/anthropic.test.ts and
judge/mistral.test.ts in the next two tasks, same as providers/types.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 5: Anthropic judge factory

**Files:**
- Create: `mcp-server/src/benchmark/judge/anthropic.ts`
- Create: `mcp-server/src/benchmark/judge/anthropic.test.ts`

**Interfaces:**
- Consumes: `ReportJudge`, `SCORE_REPORT_TOOL_NAME`, `SCORE_REPORT_TOOL_DESCRIPTION`, `scoreReportParameters`, `buildJudgePrompt`, `parseScoreReportInput` from `./types.js` (Task 4).
- Produces: `createAnthropicJudge(client: Anthropic, model: string): ReportJudge`, consumed by `run.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `mcp-server/src/benchmark/judge/anthropic.test.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { GroundTruthBug } from '../ground-truth.js';
import { createAnthropicJudge } from './anthropic.js';

const GROUND_TRUTH: GroundTruthBug[] = [
  { id: 'bug-1', route: '/x', description: 'X is broken', category: 'ux' },
];

const ISSUES = [
  {
    severity: 'major' as const,
    category: 'ux' as const,
    description: 'X is definitely broken',
    page_url: '/x',
    recommendation: 'Fix X',
  },
];

function mockClient(verdict: Record<string, unknown>): Anthropic {
  const create = vi.fn(async () => ({
    content: [
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'score_report',
        input: verdict,
      },
    ],
    stop_reason: 'tool_use',
  }));
  return { messages: { create } } as unknown as Anthropic;
}

describe('createAnthropicJudge', () => {
  it('parses a verdict out of the tool_use block', async () => {
    const client = mockClient({
      matched: [{ ground_truth_id: 'bug-1', matched_issue_description: 'X is definitely broken' }],
      missed_ground_truth_ids: [],
      false_positives: [],
      actionable_count: 1,
      reasoning: 'Found the one known bug.',
    });
    const judge = createAnthropicJudge(client, 'claude-opus-5');

    const verdict = await judge(GROUND_TRUTH, ISSUES);

    expect(verdict.matched).toHaveLength(1);
    expect(verdict.matched[0].ground_truth_id).toBe('bug-1');
    expect(verdict.missed_ground_truth_ids).toEqual([]);
    expect(verdict.actionable_count).toBe(1);
  });

  it('throws when the model returns no tool_use block', async () => {
    const client = {
      messages: {
        create: vi.fn(async () => ({
          content: [{ type: 'text', text: 'no' }],
          stop_reason: 'end_turn',
        })),
      },
    } as unknown as Anthropic;
    const judge = createAnthropicJudge(client, 'claude-opus-5');

    await expect(judge(GROUND_TRUTH, ISSUES)).rejects.toThrow(
      /did not return a score_report tool call/,
    );
  });

  it('calls the SDK with the model and a forced score_report tool_choice', async () => {
    const client = mockClient({
      matched: [],
      missed_ground_truth_ids: ['bug-1'],
      false_positives: [],
      actionable_count: 0,
      reasoning: 'Nothing found.',
    });
    const judge = createAnthropicJudge(client, 'claude-opus-5');

    await judge(GROUND_TRUTH, ISSUES);

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5',
        tool_choice: { type: 'tool', name: 'score_report' },
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/benchmark/judge/anthropic.test.ts`
Expected: FAIL — `Cannot find module './anthropic.js'`

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/benchmark/judge/anthropic.ts`:

```ts
// mcp-server/src/benchmark/judge/anthropic.ts
import type Anthropic from '@anthropic-ai/sdk';
import {
  buildJudgePrompt,
  parseScoreReportInput,
  type ReportJudge,
  SCORE_REPORT_TOOL_DESCRIPTION,
  SCORE_REPORT_TOOL_NAME,
  scoreReportParameters,
} from './types.js';

export function createAnthropicJudge(
  client: Anthropic,
  model: string,
): ReportJudge {
  const tool: Anthropic.Tool = {
    name: SCORE_REPORT_TOOL_NAME,
    description: SCORE_REPORT_TOOL_DESCRIPTION,
    input_schema: scoreReportParameters() as Anthropic.Tool['input_schema'],
  };

  return async (groundTruth, issues) => {
    // No effort override here (unlike decideAction's effort: 'low') — judging
    // is a one-time-per-run semantic call, not a high-volume repetitive one,
    // so it gets the model's default reasoning depth.
    const response = await client.messages.create({
      model,
      max_tokens: 4_096,
      tools: [tool],
      tool_choice: { type: 'tool', name: SCORE_REPORT_TOOL_NAME },
      messages: [
        { role: 'user', content: buildJudgePrompt(groundTruth, issues) },
      ],
    });

    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!block) {
      throw new Error(
        `Model did not return a ${SCORE_REPORT_TOOL_NAME} tool call (stop_reason: ${response.stop_reason})`,
      );
    }

    return parseScoreReportInput(block.input);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/benchmark/judge/anthropic.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/benchmark/judge/anthropic.ts mcp-server/src/benchmark/judge/anthropic.test.ts
git commit -m "$(cat <<'EOF'
feat: add Anthropic judge factory for the benchmark

Same forced-tool-call pattern as createAnthropicDecider, scoring a
report's issues against ground truth instead of deciding a browser
action.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 6: Mistral judge factory

**Files:**
- Create: `mcp-server/src/benchmark/judge/mistral.ts`
- Create: `mcp-server/src/benchmark/judge/mistral.test.ts`

**Interfaces:**
- Consumes: same as Task 5, from `./types.js`.
- Produces: `createMistralJudge(client: Mistral, model: string): ReportJudge`, consumed by `run.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `mcp-server/src/benchmark/judge/mistral.test.ts`:

```ts
import type { Mistral } from '@mistralai/mistralai';
import { describe, expect, it, vi } from 'vitest';
import type { GroundTruthBug } from '../ground-truth.js';
import { createMistralJudge } from './mistral.js';

const GROUND_TRUTH: GroundTruthBug[] = [
  { id: 'bug-1', route: '/x', description: 'X is broken', category: 'ux' },
];

const ISSUES = [
  {
    severity: 'major' as const,
    category: 'ux' as const,
    description: 'X is definitely broken',
    page_url: '/x',
    recommendation: 'Fix X',
  },
];

function mockClient(verdict: Record<string, unknown> | string): Mistral {
  const complete = vi.fn(async () => ({
    choices: [
      {
        index: 0,
        finishReason: 'tool_calls',
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'score_report', arguments: verdict },
            },
          ],
        },
      },
    ],
  }));
  return { chat: { complete } } as unknown as Mistral;
}

describe('createMistralJudge', () => {
  it('parses a verdict from an object-typed tool call', async () => {
    const client = mockClient({
      matched: [{ ground_truth_id: 'bug-1', matched_issue_description: 'X is definitely broken' }],
      missed_ground_truth_ids: [],
      false_positives: [],
      actionable_count: 1,
      reasoning: 'Found the one known bug.',
    });
    const judge = createMistralJudge(client, 'mistral-small-latest');

    const verdict = await judge(GROUND_TRUTH, ISSUES);

    expect(verdict.matched).toHaveLength(1);
    expect(verdict.actionable_count).toBe(1);
  });

  it('parses a verdict when arguments arrive as a JSON string', async () => {
    const client = mockClient(
      JSON.stringify({
        matched: [],
        missed_ground_truth_ids: ['bug-1'],
        false_positives: [],
        actionable_count: 0,
        reasoning: 'Missed it.',
      }),
    );
    const judge = createMistralJudge(client, 'mistral-small-latest');

    const verdict = await judge(GROUND_TRUTH, ISSUES);

    expect(verdict.missed_ground_truth_ids).toEqual(['bug-1']);
  });

  it('throws when the model returns no tool call', async () => {
    const client = {
      chat: {
        complete: vi.fn(async () => ({
          choices: [
            { index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'no' } },
          ],
        })),
      },
    } as unknown as Mistral;
    const judge = createMistralJudge(client, 'mistral-small-latest');

    await expect(judge(GROUND_TRUTH, ISSUES)).rejects.toThrow(
      /did not return a score_report tool call/,
    );
  });

  it('calls the SDK with the model and a forced score_report toolChoice', async () => {
    const client = mockClient({
      matched: [],
      missed_ground_truth_ids: ['bug-1'],
      false_positives: [],
      actionable_count: 0,
      reasoning: 'Missed it.',
    });
    const judge = createMistralJudge(client, 'mistral-small-latest');

    await judge(GROUND_TRUTH, ISSUES);

    expect(client.chat.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mistral-small-latest',
        toolChoice: { type: 'function', function: { name: 'score_report' } },
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/benchmark/judge/mistral.test.ts`
Expected: FAIL — `Cannot find module './mistral.js'`

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/benchmark/judge/mistral.ts`:

```ts
// mcp-server/src/benchmark/judge/mistral.ts
import type { Mistral } from '@mistralai/mistralai';
import type { ChatCompletionRequestTool } from '@mistralai/mistralai/models/components';
import {
  buildJudgePrompt,
  parseScoreReportInput,
  type ReportJudge,
  SCORE_REPORT_TOOL_DESCRIPTION,
  SCORE_REPORT_TOOL_NAME,
  scoreReportParameters,
} from './types.js';

export function createMistralJudge(
  client: Mistral,
  model: string,
): ReportJudge {
  const tool: ChatCompletionRequestTool = {
    type: 'function',
    function: {
      name: SCORE_REPORT_TOOL_NAME,
      description: SCORE_REPORT_TOOL_DESCRIPTION,
      parameters: scoreReportParameters(),
    },
  };

  return async (groundTruth, issues) => {
    const response = await client.chat.complete({
      model,
      tools: [tool],
      toolChoice: {
        type: 'function',
        function: { name: SCORE_REPORT_TOOL_NAME },
      },
      messages: [
        { role: 'user', content: buildJudgePrompt(groundTruth, issues) },
      ],
    });

    const toolCall = response.choices[0]?.message?.toolCalls?.[0];
    if (!toolCall) {
      throw new Error(
        `Model did not return a ${SCORE_REPORT_TOOL_NAME} tool call (finish_reason: ${response.choices[0]?.finishReason})`,
      );
    }

    const rawArgs = toolCall.function.arguments;
    const input = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    return parseScoreReportInput(input);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/benchmark/judge/mistral.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/benchmark/judge/mistral.ts mcp-server/src/benchmark/judge/mistral.test.ts
git commit -m "$(cat <<'EOF'
feat: add Mistral judge factory for the benchmark

Mirrors createMistralDecider's pattern for the score_report tool
instead of decide_action.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 7: Benchmark CLI runner

**Files:**
- Create: `mcp-server/src/benchmark/run.ts`
- Create: `mcp-server/src/benchmark/run.test.ts`

**Interfaces:**
- Consumes:
  - `runHeadlessTest`, `resolveProvider`, `createDecider`, `type Provider`, `type ResolvedProvider` from `../cli/headless.js` (all already exported).
  - `isMainModule` from `../is-main-module.js` (Task 1).
  - `loadGroundTruth` from `./ground-truth.js` (Task 2).
  - `checkReportFormat` from `./format-check.js` (Task 3).
  - `createAnthropicJudge` from `./judge/anthropic.js` (Task 5), `createMistralJudge` from `./judge/mistral.js` (Task 6), `type ReportJudge` from `./judge/types.js` (Task 4).
  - `SessionManager` from `../session/manager.js`.
  - `type ActionDecider` from `../cli/providers/types.js`.
  - `type Issue` from `../types.js`.
- Produces: `parseArgs`, `runBenchmark`, `type BenchmarkOptions`, `type Scorecard` — all exported for testing. `main()` is the bin entrypoint, not exported.

- [ ] **Step 1: Write the failing tests**

Create `mcp-server/src/benchmark/run.test.ts`:

```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SessionManager } from '../session/manager.js';
import type { ActionDecider } from '../cli/providers/types.js';
import type { Issue } from '../types.js';
import type { ReportJudge } from './judge/types.js';
import { parseArgs, runBenchmark } from './run.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GROUND_TRUTH_FIXTURE = resolve(__dirname, '__fixtures__/ground-truth.json');

describe('parseArgs', () => {
  it('applies defaults when nothing is passed', () => {
    const options = parseArgs([]);
    expect(options).toEqual({
      targetUrl: 'http://localhost:3000',
      groundTruthPath: 'demo/benchmark-ground-truth.json',
      provider: undefined,
      model: undefined,
      outPath: undefined,
    });
  });

  it('parses a positional URL and all flags', () => {
    const options = parseArgs([
      'http://localhost:4000',
      '--ground-truth',
      './custom-ground-truth.json',
      '--provider',
      'mistral',
      '--model',
      'mistral-small-latest',
      '--out',
      './scorecard.json',
    ]);
    expect(options).toEqual({
      targetUrl: 'http://localhost:4000',
      groundTruthPath: './custom-ground-truth.json',
      provider: 'mistral',
      model: 'mistral-small-latest',
      outPath: './scorecard.json',
    });
  });

  it('throws on an unknown --provider value', () => {
    expect(() => parseArgs(['--provider', 'openai'])).toThrow(
      /--provider must be "anthropic" or "mistral"/,
    );
  });
});

function fakeDecider(): ActionDecider {
  return async () => ({ action: 'press A', issues: [] });
}

function fakeJudge(overrides: Partial<Awaited<ReturnType<ReportJudge>>> = {}): ReportJudge {
  return async () => ({
    matched: [],
    missed_ground_truth_ids: ['test-bug-one', 'test-bug-two'],
    false_positives: [],
    actionable_count: 0,
    reasoning: 'Nothing matched in this fake run.',
    ...overrides,
  });
}

describe('runBenchmark', () => {
  it('wires the report, format check, and judge verdict into a scorecard', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider();
    const judge = fakeJudge({
      matched: [
        { ground_truth_id: 'test-bug-one', matched_issue_description: 'desc' },
      ],
      missed_ground_truth_ids: ['test-bug-two'],
      false_positives: [{ description: 'not real', reason: 'tooling artifact' }],
      actionable_count: 1,
    });

    const scorecard = await runBenchmark(decide, judge, manager, {
      targetUrl: 'data:text/html,<input type="text" />',
      groundTruthPath: GROUND_TRUTH_FIXTURE,
    });

    expect(scorecard.ground_truth_total).toBe(2);
    expect(scorecard.recall).toBe(1);
    expect(scorecard.missed_ground_truth_ids).toEqual(['test-bug-two']);
    expect(scorecard.false_positive_count).toBe(1);
    expect(scorecard.actionable_count).toBe(1);
    expect(scorecard.format_ok).toBe(true);
    expect(scorecard.format_missing).toEqual([]);
    expect(scorecard.report_path).toContain('.md');
  }, 15_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/benchmark/run.test.ts`
Expected: FAIL — `Cannot find module './run.js'`

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/benchmark/run.ts`:

```ts
#!/usr/bin/env node
// mcp-server/src/benchmark/run.ts
//
// Scores a haunt report against known ground-truth bugs for a target app.
// Reuses haunt-ci's machinery (runHeadlessTest, resolveProvider, createDecider)
// to produce the report, then adds one more LLM call (the "judge") to
// semantically match reported issues against ground truth, plus a
// deterministic format check. This is what turns "it seems to work now"
// into a repeatable, scriptable signal for report-quality regressions.
//
// Run from the repo root so the default ground-truth path resolves, or pass
// --ground-truth explicitly. Costs one real LLM API call for the persona loop
// plus one for the judge, same provider/key rules as haunt-ci.
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { Mistral } from '@mistralai/mistralai';
import {
  createDecider,
  type Provider,
  resolveProvider,
  type ResolvedProvider,
  runHeadlessTest,
} from '../cli/headless.js';
import type { ActionDecider } from '../cli/providers/types.js';
import { isMainModule } from '../is-main-module.js';
import { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';
import { checkReportFormat } from './format-check.js';
import { loadGroundTruth } from './ground-truth.js';
import { createAnthropicJudge } from './judge/anthropic.js';
import { createMistralJudge } from './judge/mistral.js';
import type { ReportJudge } from './judge/types.js';

export interface BenchmarkOptions {
  targetUrl: string;
  groundTruthPath: string;
  provider?: Provider;
  model?: string;
  outPath?: string;
}

const USAGE =
  'Usage: haunt-benchmark [url] [--ground-truth path] [--provider anthropic|mistral] [--model id] [--out path]';
const DEFAULT_TARGET_URL = 'http://localhost:3000';
const DEFAULT_GROUND_TRUTH_PATH = 'demo/benchmark-ground-truth.json';
const BENCHMARK_PERSONA = 'confused-beginner';
const BENCHMARK_STEPS = 3;

const VALUED_FLAGS = ['ground-truth', 'provider', 'model', 'out'];

export function parseArgs(argv: string[]): BenchmarkOptions {
  const getFlag = (name: string): string | undefined => {
    const idx = argv.indexOf(`--${name}`);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };

  const consumedValueIndices = new Set(
    VALUED_FLAGS.map((name) => argv.indexOf(`--${name}`))
      .filter((idx) => idx !== -1)
      .map((idx) => idx + 1),
  );
  const targetUrl =
    argv.find((a, i) => !a.startsWith('--') && !consumedValueIndices.has(i)) ??
    DEFAULT_TARGET_URL;

  const providerFlag = getFlag('provider');
  if (providerFlag && providerFlag !== 'anthropic' && providerFlag !== 'mistral') {
    throw new Error(
      `--provider must be "anthropic" or "mistral", got: ${providerFlag}`,
    );
  }

  return {
    targetUrl,
    groundTruthPath: getFlag('ground-truth') ?? DEFAULT_GROUND_TRUTH_PATH,
    provider: providerFlag as Provider | undefined,
    model: getFlag('model'),
    outPath: getFlag('out'),
  };
}

function createJudge(resolved: ResolvedProvider): ReportJudge {
  if (resolved.provider === 'anthropic') {
    return createAnthropicJudge(new Anthropic(), resolved.model);
  }
  return createMistralJudge(
    new Mistral({ apiKey: process.env.MISTRAL_API_KEY }),
    resolved.model,
  );
}

function loadReportIssues(reportPath: string): Issue[] {
  const sidecarPath = reportPath.endsWith('.md')
    ? `${reportPath.slice(0, -3)}.json`
    : `${reportPath}.json`;
  const parsed = JSON.parse(readFileSync(sidecarPath, 'utf-8'));
  return parsed.issues as Issue[];
}

export interface Scorecard {
  target_url: string;
  report_path: string;
  ground_truth_total: number;
  recall: number;
  missed_ground_truth_ids: string[];
  false_positive_count: number;
  total_issues: number;
  actionable_count: number;
  format_ok: boolean;
  format_missing: string[];
  judge_reasoning: string;
}

export async function runBenchmark(
  decide: ActionDecider,
  judge: ReportJudge,
  manager: SessionManager,
  options: Pick<BenchmarkOptions, 'targetUrl' | 'groundTruthPath'>,
): Promise<Scorecard> {
  const groundTruth = loadGroundTruth(options.groundTruthPath);

  const { report } = await runHeadlessTest(decide, manager, {
    targetUrl: options.targetUrl,
    personas: [BENCHMARK_PERSONA],
    steps: BENCHMARK_STEPS,
    headless: true,
  });

  const issues = loadReportIssues(report.report_path);
  const format = checkReportFormat(report.markdown);
  const verdict = await judge(groundTruth, issues);

  return {
    target_url: options.targetUrl,
    report_path: report.report_path,
    ground_truth_total: groundTruth.length,
    recall: verdict.matched.length,
    missed_ground_truth_ids: verdict.missed_ground_truth_ids,
    false_positive_count: verdict.false_positives.length,
    total_issues: issues.length,
    actionable_count: verdict.actionable_count,
    format_ok: format.ok,
    format_missing: format.missing,
    judge_reasoning: verdict.reasoning,
  };
}

function printScorecard(scorecard: Scorecard): void {
  const rule = '-'.repeat(40);
  const lines = [
    rule,
    `target: ${scorecard.target_url}`,
    `report: ${scorecard.report_path}`,
    `recall: ${scorecard.recall}/${scorecard.ground_truth_total}`,
    scorecard.missed_ground_truth_ids.length > 0
      ? `missed: ${scorecard.missed_ground_truth_ids.join(', ')}`
      : 'missed: none',
    `false positives: ${scorecard.false_positive_count}`,
    `actionable: ${scorecard.actionable_count}/${scorecard.total_issues}`,
    `format: ${
      scorecard.format_ok
        ? 'ok'
        : `FAILED (${scorecard.format_missing.join(', ')})`
    }`,
    '',
    'judge reasoning:',
    scorecard.judge_reasoning,
    rule,
  ];
  console.log(lines.join('\n'));
}

async function main() {
  let options: BenchmarkOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  let resolved: ResolvedProvider;
  try {
    resolved = resolveProvider(options, process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  console.error(
    `[haunt-benchmark] provider: ${resolved.provider}, model: ${resolved.model}`,
  );

  const decide = createDecider(resolved);
  const judge = createJudge(resolved);
  const manager = new SessionManager();

  try {
    const scorecard = await runBenchmark(decide, judge, manager, options);
    printScorecard(scorecard);
    if (options.outPath) {
      writeFileSync(options.outPath, JSON.stringify(scorecard, null, 2), 'utf-8');
    }
    process.exit(0);
  } catch (error) {
    console.error(
      'haunt-benchmark failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(2);
  }
}

if (isMainModule(import.meta.url)) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/benchmark/run.test.ts`
Expected: PASS (4 tests). The `runBenchmark` test takes a few seconds (real Chromium launch against a `data:` URL) — that's expected, matching `headless.test.ts`'s existing pattern.

- [ ] **Step 5: Typecheck and lint**

Run: `cd mcp-server && npm run typecheck && npx biome check --write src`
Expected: typecheck passes; biome reports no issues (or auto-fixes formatting only).

- [ ] **Step 6: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/src/benchmark/run.ts mcp-server/src/benchmark/run.test.ts
git commit -m "$(cat <<'EOF'
feat: add haunt-benchmark CLI runner

Wires together runHeadlessTest (reused from cli/headless.ts),
format-check, and the judge into one scorecard: recall against ground
truth, false positives, actionable-fix count, format compliance. This
is the piece that turns report-quality checking into a one-command,
scriptable signal instead of manual live testing.

decide/judge are injected into runBenchmark (not constructed inside
it), matching runHeadlessTest's own testable design — main() is the
only place that wires up real SDK clients via createDecider/createJudge.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 8: Ship it — tsup entry, bin, vendor script, full verification

**Files:**
- Modify: `mcp-server/tsup.config.ts`
- Modify: `mcp-server/package.json`
- Modify: `mcp-server/scripts/vendor-playwright.mjs`

**Interfaces:**
- Consumes: nothing new — this task only wires up build/packaging for `benchmark/run.ts` (Task 7).
- Produces: `mcp-server/dist/benchmark.js`, `bin: "haunt-benchmark"` — this is the artifact `docs/benchmark.md` (Task 9) tells users to run.

- [ ] **Step 1: Add the third tsup entry**

In `mcp-server/tsup.config.ts`, change:

```ts
entry: { server: 'src/index.ts', cli: 'src/cli/headless.ts' },
```

to:

```ts
entry: {
  server: 'src/index.ts',
  cli: 'src/cli/headless.ts',
  benchmark: 'src/benchmark/run.ts',
},
```

- [ ] **Step 2: Add the bin entry**

In `mcp-server/package.json`, change:

```json
  "bin": {
    "haunt-ci": "dist/cli.js"
  },
```

to:

```json
  "bin": {
    "haunt-ci": "dist/cli.js",
    "haunt-benchmark": "dist/benchmark.js"
  },
```

- [ ] **Step 3: Chmod the new binary in the postbuild script too**

In `mcp-server/scripts/vendor-playwright.mjs`, the existing block:

```js
// tsup preserves the shebang from src/cli/headless.ts, but the executable bit
// itself isn't set on a fresh build output — needed for `bin/haunt-ci` and direct
// `./dist/cli.js` invocation (irrelevant on Windows, where npm generates its own
// .cmd shim regardless).
const cliPath = join(root, 'dist', 'cli.js');
if (existsSync(cliPath)) {
  chmodSync(cliPath, 0o755);
  console.log('[vendor-playwright] chmod +x dist/cli.js');
}
```

becomes:

```js
// tsup preserves the shebang from src/cli/headless.ts and src/benchmark/run.ts,
// but the executable bit itself isn't set on a fresh build output — needed for
// `bin/haunt-ci`, `bin/haunt-benchmark`, and direct `./dist/*.js` invocation
// (irrelevant on Windows, where npm generates its own .cmd shim regardless).
for (const binFile of ['cli.js', 'benchmark.js']) {
  const binPath = join(root, 'dist', binFile);
  if (existsSync(binPath)) {
    chmodSync(binPath, 0o755);
    console.log(`[vendor-playwright] chmod +x dist/${binFile}`);
  }
}
```

- [ ] **Step 4: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: build succeeds, output includes `dist/benchmark.js`, postbuild logs `chmod +x dist/cli.js` and `chmod +x dist/benchmark.js`.

Run: `head -1 dist/benchmark.js`
Expected: `#!/usr/bin/env node`

Run: `ls -la dist/benchmark.js`
Expected: executable bit set (`-rwxr-xr-x` or similar).

- [ ] **Step 5: Run the full test suite, lint, and typecheck**

Run: `cd mcp-server && npm run lint && npm run typecheck && npm test`
Expected: all pass — this now includes every test from Tasks 1-7 plus the full pre-existing suite (should be at or above 74 pre-existing + roughly 20 new = ~94 tests).

- [ ] **Step 6: Smoke-test the built binary's argument handling (no API key needed for this check)**

Run: `env -u ANTHROPIC_API_KEY -u MISTRAL_API_KEY node dist/benchmark.js`
Expected: prints a "No API key found..." error (from `resolveProvider`) and exits 2 — confirms the binary runs, parses args, and fails cleanly without ever attempting a real API call. Do NOT run it with a real API key in this task — that's Task 9's live validation, done only after the user confirms.

- [ ] **Step 7: Commit**

```bash
cd /Users/matt/dev/haunt
git add mcp-server/tsup.config.ts mcp-server/package.json mcp-server/scripts/vendor-playwright.mjs mcp-server/dist
git commit -m "$(cat <<'EOF'
build: ship haunt-benchmark as a third bin entry

New tsup entry (dist/benchmark.js) and package.json bin, following
dist/cli.js's exact wiring. vendor-playwright.mjs's chmod step now
loops over both binaries instead of hardcoding cli.js.

Verified: build succeeds, dist/benchmark.js has its shebang and
executable bit, full test suite passes, and the built binary fails
cleanly (exit 2, clear message, no API call attempted) when no
provider key is set.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

### Task 9: Methodology write-up

**Files:**
- Create: `docs/benchmark.md`

**Interfaces:**
- Consumes: nothing — this is documentation of the finished tool from Tasks 1-8.
- Produces: nothing consumed by other tasks — this is the last task in the plan.

- [ ] **Step 1: Write the methodology doc**

Create `docs/benchmark.md`:

```markdown
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

**Cost:** one real LLM call for the persona loop (same as `haunt-ci`) plus
one for the judge call, every run.

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
- **4-area scouting cap.** The persona loop's route discovery (same as the
  interactive `/haunt-test` command) caps at 4 auto-discovered areas. With 5
  ground-truth bugs spread across 5 routes, a run can structurally miss one
  bug's route even with perfect detection on every area it did visit.
- **The judge is an LLM, not an oracle.** Semantic matching between free-text
  issue descriptions and ground-truth bugs is exactly the kind of judgment
  call that can be wrong in either direction — a real match missed, or a
  coincidental phrase wrongly counted as one.
- **`lib/auth.ts`'s password-logging bug is excluded by construction.** It
  only shows up in server logs — no browser-driven persona can find it, so
  it was never included in the scored ground truth. Max achievable recall
  against `demo/`'s full bug list is 5/6, not 6/6.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matt/dev/haunt
git add docs/benchmark.md
git commit -m "$(cat <<'EOF'
docs: add report-quality benchmark methodology

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BuuSicyknYrgFDX1MdbjAC
EOF
)"
```

---

## After this plan

The benchmark tool is built, tested, and committed — but not yet run for
real against the live demo app (Task 8's smoke test deliberately avoids
spending API credits). Two things remain, both outside this plan because
they need the user's explicit go-ahead before spending money:

1. A real `haunt-benchmark` run against current `master` (confirm provider/
   key with the user first).
2. The one-off, manually-driven v1-vs-v2 historical comparison described in
   the design spec's "What this session's v1-vs-v2 comparison does
   differently" section — not part of the reusable benchmark, a separate
   historical exercise using the same scoring pipeline.
