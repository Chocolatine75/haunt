// mcp-server/src/mcp/tools.ts
//
// The MCP tool surface: one entry per tool, with its input as a zod schema.
// That schema is the single source for what a host sees (the JSON Schema in
// tools/list is generated from it), for what the server accepts (arguments
// are parsed with it before the engine runs), and for the types: `run` hands
// the parsed input to an engine function, so a schema that drifts from the
// engine's input type is a compile error here rather than a runtime surprise.
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { hauntAct } from '../engine/act/act.js';
import { actionSchema } from '../engine/act/schema.js';
import { hauntCaptureState } from '../engine/capture.js';
import { briefEnd, hauntEndSession, heldBack } from '../engine/end-session.js';
import { hauntReplay } from '../engine/evidence/replay.js';
import { hauntGetCookies } from '../engine/get-cookies.js';
import { hauntPlan } from '../engine/plan/plan.js';
import {
  expectationSchema,
  listQuerySchema,
  planCaseSchema,
} from '../engine/plan/schema.js';
import { hauntEstimateCost } from '../engine/report/estimate-cost.js';
import { hauntGenerateReport } from '../engine/report/generate-report.js';
import { hauntScout } from '../engine/scout.js';
import type { SessionManager } from '../engine/session/manager.js';
import { hauntSpawn } from '../engine/spawn.js';
import { hauntSweep } from '../engine/sweep.js';
import { SIGNAL_KINDS } from '../gates/part-2/contract.js';
import { CASE_KINDS } from '../gates/part-4/contract.js';

const issueSchema = z.object({
  severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
  category: z.enum([
    'ux',
    'accessibility',
    'performance',
    'security',
    'content',
  ]),
  description: z.string(),
  page_url: z.string(),
  recommendation: z.string(),
  signal: z
    .string()
    .optional()
    .describe(
      'The id of the signal this issue is about (s3). An issue that names a signal, a case or an observation is replayed and confirmed; one with none is only listed for a person to check',
    ),
  observed: expectationSchema
    .optional()
    .describe(
      'For an issue no signal shows: the fact about the page the engine checks by replaying the steps (a message that is or is not there, an address, an element’s state, the items of a list, what a control holds)',
    ),
  case: z
    .string()
    .optional()
    .describe(
      'The test case whose check failed. The engine replays the case and checks the same expectation',
    ),
  expected: z
    .string()
    .optional()
    .describe(
      'For an issue the engine cannot check: what you expected. Listed under "To check by hand"',
    ),
  actual: z.string().optional().describe('And what you saw instead'),
});

// How an issue or a signal fared when replayed (part 3), passed back to the
// report as haunt_end_session returned it.
const verificationSchema = z
  .object({
    status: z.enum([
      'confirmed',
      'flaky',
      'rejected',
      'unverified',
      'unchecked',
    ]),
    attempts: z.number().int().min(0),
    reproduced: z.number().int().min(0),
    rate: z.number().min(0).max(1),
    reason: z.string().optional(),
    failed_step: z.number().int().optional(),
    bundle: z.string().optional(),
  })
  .passthrough();

// An issue as haunt_end_session returns it.
const reportIssueSchema = issueSchema.extend({
  verification: verificationSchema.optional(),
});

// A signal as haunt_act, haunt_end_session and the others return it, passed
// back to the report as it came: its other fields go to the sidecar.
const signalSchema = z
  .object({
    id: z.string(),
    // Part 2's kinds, and the layout defects of part 5.
    kind: z.enum([...SIGNAL_KINDS, 'layout']),
    url: z.string(),
    step: z.number().int().min(0),
    message: z.string(),
    severity: z.enum(['major', 'minor']),
    count: z.number().int().positive(),
  })
  .passthrough();

// A case and a control as haunt_end_session returns them, for the report.
const caseStatusSchema = z
  .object({
    id: z.string(),
    kind: z.enum(CASE_KINDS),
    controls: z.array(z.string()),
    expect: z.string(),
    verdict: z.enum(['passed', 'failed']).optional(),
  })
  .passthrough();

const inventoryControlSchema = z
  .object({
    ref: z.string(),
    role: z.string(),
    name: z.string(),
    group: z.string(),
    state: z.enum(['hidden', 'disabled', 'covered']).optional(),
    exercised: z.boolean(),
    planned: z.boolean(),
  })
  .passthrough();

const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  // Instead of domain and path, as Playwright takes either.
  url: z.string().optional(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
});

export interface ToolDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  input: S;
  // When what is accepted is deliberately looser than what is documented:
  // the schema shown to hosts. Defaults to `input`.
  listing?: z.ZodTypeAny;
  // Declared as a method so definitions with different input schemas can sit
  // in one array.
  run(manager: SessionManager, input: z.infer<S>): unknown;
}

function defineTool<S extends z.ZodTypeAny>(
  tool: ToolDefinition<S>,
): ToolDefinition<S> {
  return tool;
}

// One session of a report: what haunt_end_session returned, and its area.
const sessionSchema = z.object({
  area: z.string().describe('The route/area this session tested, e.g. /signup'),
  persona: z.string().optional(),
  overall_impression: z.string(),
  cases: z
    .array(caseStatusSchema)
    .optional()
    .describe("This session's EndSessionOutput.cases, as returned"),
  inventory: z
    .array(inventoryControlSchema)
    .optional()
    .describe(
      "This session's EndSessionOutput.inventory, as returned: the report counts coverage from it, each control once across the sessions of an area",
    ),
  issues: z
    .array(reportIssueSchema)
    .describe(
      "This session's EndSessionOutput.issues_found, as returned (with their verification)",
    ),
  rejected: z
    .array(reportIssueSchema)
    .optional()
    .describe("This session's EndSessionOutput.rejected"),
  sandbox_blocked_requests: z
    .array(z.string())
    .optional()
    .describe("This session's EndSessionOutput.sandbox_blocked_requests"),
  signals: z
    .array(signalSchema)
    .optional()
    .describe(
      "This session's EndSessionOutput.signals, as returned: those no issue names get a section of their own",
    ),
  signal_verification: z
    .record(verificationSchema)
    .optional()
    .describe(
      "This session's EndSessionOutput.signal_verification: only confirmed major signals count in haunt-ci's verdict",
    ),
});

export const TOOLS: ToolDefinition[] = [
  defineTool({
    name: 'haunt_spawn',
    description:
      'Open a browser session on the target URL. Returns its id and what went wrong while the page loaded.',
    input: z.object({
      persona: z
        .string()
        .optional()
        .describe('No longer used. Accepted and ignored'),
      target_url: z
        .string()
        .describe('URL to test (e.g. http://localhost:3000)'),
      headless: z
        .boolean()
        .optional()
        .describe('Run browser in headless mode. Default: true'),
      budget: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          'How many actions the session may run before it has to end. Default: 40',
        ),
      timeout: z.number().optional().describe('Older name of `budget`'),
      keep_going: z
        .boolean()
        .optional()
        .describe(
          'Refuse a first haunt_end_session while test cases have no verdict or controls were never used and a quarter of the budget is left: the answer lists what is left instead of ending. The next call ends the session. Default: false',
        ),
      narrow_check: z
        .boolean()
        .optional()
        .describe(
          'Before the session ends, read its layout once more on a window 375 px wide: what breaks on a phone shows there. Default: false',
        ),
      hostile: z
        .boolean()
        .optional()
        .describe(
          'Allow test cases of kind `hostile`, which send attack payloads. Only against an app you own. Default: false',
        ),
      cookies: z
        .array(cookieSchema)
        .optional()
        .describe(
          'Session cookies to inject before navigation (for authenticated testing)',
        ),
      secrets: z
        .array(z.string())
        .optional()
        .describe(
          'Values to keep out of everything haunt returns or writes, though this session never types them: the email and password it was signed in with. Pass them with the cookies of that login.',
        ),
      signal_thresholds: z
        .object({
          slow_response_ms: z.number().positive().optional(),
          long_task_ms: z.number().positive().optional(),
          hung_request_ms: z.number().positive().optional(),
        })
        .strict()
        .optional()
        .describe(
          'Above which a response is reported as slow (default 3000), a main-thread task as long (500), a request as hung (10000)',
        ),
      replay_budget_ms: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          'How long haunt_end_session may spend replaying the issues to verify them. Default: 120000',
        ),
      bundle_cap_bytes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          'How large one evidence bundle may grow before its trace, then its screenshot, are dropped. Default: 5 MB',
        ),
    }),
    run: (manager, input) => hauntSpawn(manager, input),
  }),
  defineTool({
    name: 'haunt_scout',
    description:
      "The areas of an app worth testing, from the links its page really has: opens the URL, returns the distinct paths on its own origin (the URL's own first), and closes. One call, no session left open. Never guesses a route.",
    input: z.object({
      target_url: z.string().describe('URL to start from'),
      headless: z.boolean().optional(),
      cookies: z
        .array(cookieSchema)
        .optional()
        .describe('Session cookies, to scout as a logged-in user'),
      secrets: z.array(z.string()).optional(),
      max: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('How many routes at most. Default: 4'),
    }),
    run: (manager, input) => hauntScout(manager, input),
  }),
  defineTool({
    name: 'haunt_sweep',
    description:
      "Press the buttons of an area that no tester pressed, each on the page as it loads, and report what breaks: a button wired to nothing, a handler that throws, a failed request. One call, no session left open: it ends its own session, whose id goes to haunt_generate_report with the testers'. Presses nothing inside a form and nothing whose name says it deletes, pays, sends or signs out.",
    input: z.object({
      target_url: z.string().describe('The area to sweep'),
      sessions: z
        .array(z.string())
        .optional()
        .describe(
          'The ids of the sessions that tested this area, ended or not: a button one of them exercised is not pressed again',
        ),
      max: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('How many buttons to press at most. Default: 20'),
      headless: z.boolean().optional(),
      cookies: z
        .array(cookieSchema)
        .optional()
        .describe('Session cookies, to sweep as a logged-in user'),
      secrets: z.array(z.string()).optional(),
      replay_budget_ms: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          'How long it may spend replaying what it found to verify it. Default: 120000',
        ),
      bundle_cap_bytes: z.number().int().positive().optional(),
    }),
    run: (manager, input) => hauntSweep(manager, input),
  }),
  defineTool({
    name: 'haunt_get_cookies',
    description:
      'Extract all cookies from the current browser session. Use after a successful login to capture the session cookies for reuse in authenticated test sessions.',
    input: z.object({
      session_id: z.string().describe('Session ID from haunt_spawn'),
    }),
    run: (manager, input) => hauntGetCookies(manager, input),
  }),
  defineTool({
    name: 'haunt_act',
    description:
      'Run one or more actions on elements named by their reference from the snapshot (click, fill, type, press, select, check, hover, scroll, drag, upload, goto, tab, dialog, wait_for, read…). Each action reports what it really changed: navigation, new tab, dialog, download, or nothing at all. A sequence stops at the first failure, navigation, dialog or new tab. A failed action says why (covered and by what, disabled, stale reference…); it is information, not necessarily an app bug.',
    // Each action is checked by the engine, so that a malformed one is
    // reported as a failed step (with the others in the sequence) rather
    // than rejecting the whole call.
    input: z.object({
      session_id: z.string(),
      actions: z.array(z.record(z.unknown())).min(1),
      issues: z.array(issueSchema).optional(),
      case: z.string().optional(),
      expect: expectationSchema.optional(),
    }),
    listing: z.object({
      session_id: z.string().describe('Session ID from haunt_spawn'),
      actions: z
        .array(actionSchema)
        .min(1)
        .describe(
          'Run in order; execution stops when one fails or changes the page under the rest',
        ),
      issues: z
        .array(issueSchema)
        .optional()
        .describe('Issues the orchestrator observed during this step'),
      case: z
        .string()
        .optional()
        .describe(
          'The test case of the plan these actions play. With `expect`, the check gives the case its verdict',
        ),
      expect: expectationSchema
        .optional()
        .describe(
          'What you expect once these actions have run, stated before you see the result. The engine checks it and answers `expectation: { held, read }`',
        ),
    }),
    run: (manager, input) => hauntAct(manager, input),
  }),
  defineTool({
    name: 'haunt_plan',
    description:
      'The test plan of a session. With only a session id: the inventory (every control the session was shown, with its group, its state, and whether it was exercised), the cases, and the coverage, counted by the engine from the actions that ran. With `cases`: registers test cases. With `close`: gives a verdict to a case the engine cannot check by itself.',
    input: z.object({
      session_id: z.string().describe('Session ID from haunt_spawn'),
      cases: z.array(planCaseSchema).optional(),
      from: z
        .string()
        .optional()
        .describe(
          "The id of another session, live or ended: registers its cases here, resolved to this session's controls. How a tester takes the cases a planner wrote",
        ),
      only: z
        .array(z.string())
        .optional()
        .describe('With `from`: the ids of the cases to take. Default: all'),
      brief: z
        .boolean()
        .optional()
        .describe(
          'Leave the inventory out of the answer: only the cases and the coverage. Use it once you have read the inventory',
        ),
      close: z
        .array(
          z.object({
            id: z.string(),
            verdict: z.enum(['passed', 'failed']),
            note: z.string().describe('What you saw, in one sentence'),
          }),
        )
        .optional(),
    }),
    // On a page of a hundred controls the inventory is most of the answer,
    // and a caller that has read it once does not need it back with every
    // case it registers.
    run: async (manager, { brief, ...input }) => {
      const plan = await hauntPlan(manager, input);
      return brief ? { cases: plan.cases, coverage: plan.coverage } : plan;
    },
  }),
  defineTool({
    name: 'haunt_capture_state',
    description:
      'Capture the current page as a snapshot: every actionable element with a stable reference like [e12], in reading order with the surrounding text, across frames and shadow roots. Call this before deciding each action; use the references with haunt_act.',
    input: z.object({
      session_id: z.string(),
      format: z
        .enum(['text', 'json'])
        .optional()
        .describe(
          'text: the snapshot as a model reads it, paged when large. json: the same snapshot as data.',
        ),
      diff: z
        .boolean()
        .optional()
        .describe('Also return what changed since the previous snapshot'),
      within: z
        .string()
        .optional()
        .describe('Reference of an element: limit the snapshot to its subtree'),
      actionable_only: z
        .boolean()
        .optional()
        .describe('Leave out the surrounding text, keep only elements'),
      page: z
        .number()
        .optional()
        .describe('Which page of a text snapshot that did not fit in one'),
      include_attributes: z
        .array(z.string())
        .optional()
        .describe('Attributes to report for each element, e.g. data-testid'),
      include_screenshot: z
        .boolean()
        .optional()
        .describe('Also save a screenshot. Default: false'),
      signals: z
        .boolean()
        .optional()
        .describe(
          'Also list every signal raised so far on the current page: HTTP errors, exceptions, failed, hung and slow requests, dead controls, accessibility violations',
        ),
      audit: z
        .boolean()
        .optional()
        .describe(
          'Run the accessibility audit (axe-core, WCAG 2 A and AA) on the page as it is now and list its violations with the other signals of the page. Each page is already audited once, when first reached; ask again after the page has changed',
        ),
      list: listQuerySchema
        .optional()
        .describe(
          'Also return the items of a container exactly as the page shows them, to look before stating an expectation about them',
        ),
    }),
    run: (manager, input) => hauntCaptureState(manager, input),
  }),
  defineTool({
    name: 'haunt_end_session',
    description:
      'Close the browser session, replay every issue in a fresh browser to verify it, and return them: confirmed, flaky (with the rate a replay reproduced it) or unverified in issues_found, each with its evidence bundle; rejected ones apart, with why. A session spawned with keep_going that still has work left answers `ended: false` once, with what is left, and stays open.',
    input: z.object({
      session_id: z.string(),
      brief: z
        .boolean()
        .optional()
        .describe(
          'Return what became of each issue and the counts, without the signals and the inventory. They stay on the server: haunt_generate_report takes them from the session id',
        ),
      overall_impression: z
        .string()
        .optional()
        .describe('What the session found, in a sentence or two'),
      issues: z
        .array(issueSchema)
        .optional()
        .describe(
          'Issues found since the last haunt_act call, typically from the result of the last action',
        ),
    }),
    // An agent that ends its session needs to know what became of its
    // issues, not to carry a hundred controls back to whoever spawned it.
    run: async (manager, { brief, ...input }) => {
      const held = await heldBack(manager, input);
      if (held) return held;
      const ended = await hauntEndSession(manager, input);
      return brief ? briefEnd(ended) : ended;
    },
  }),
  defineTool({
    name: 'haunt_estimate_cost',
    description:
      'Compute the browser-call cost estimate for a planned test run (route count × steps). Call before Phase 2 to print the "proceed?" confirmation.',
    input: z.object({
      route_count: z
        .number()
        .describe('Number of areas/routes in the page plan'),
      steps_per_route: z
        .number()
        .describe('Max navigation steps per route (the --steps value)'),
    }),
    run: (_manager, input) => hauntEstimateCost(input),
  }),
  defineTool({
    name: 'haunt_generate_report',
    description:
      'Compute issue counts, sort issues by severity, render the markdown report, and write it to .haunt-reports/. Returns the exact terminal summary to print. Call once in Phase 3 after all sessions have ended — do not hand-write the report file.',
    input: z.object({
      target_url: z.string(),
      personas: z
        .array(z.string())
        .optional()
        .describe('No longer used: personas are gone. Accepted and ignored'),
      spec: z
        .string()
        .optional()
        .describe(
          'The name of the description of the app the testers were given, if any',
        ),
      sessions: z
        .array(
          sessionSchema
            .partial({ overall_impression: true, issues: true })
            .extend({
              session_id: z
                .string()
                .optional()
                .describe(
                  'The id of a session that has ended: its result is taken from the server, and the other fields here only add to it or correct it. Prefer this to passing the result yourself',
                ),
            }),
        )
        .describe('One entry per ended session'),
      compare_with: z
        .string()
        .optional()
        .describe(
          'Path to a previous report (its .md path, or the .json sidecar directly) to diff against. Annotates each current issue as new vs. still present, and lists issues from that run no longer found.',
        ),
    }),
    run: (manager, input) =>
      hauntGenerateReport({
        ...input,
        sessions: input.sessions.map((given) => {
          const { session_id, ...own } = given;
          if (session_id === undefined) return sessionSchema.parse(own);
          const ended = manager.endedSession(session_id);
          if (!ended) {
            throw new Error(
              `No ended session ${session_id}: end it with haunt_end_session before the report, or pass its result.`,
            );
          }
          // What the session returned when it ended, under what the caller
          // adds or corrects: its area, its impression.
          return sessionSchema.parse({
            ...ended.result,
            // Named `issues_found` where a session returns them.
            issues: ended.result.issues_found,
            ...own,
          });
        }),
      }),
  }),
  defineTool({
    name: 'haunt_replay',
    description:
      'Replay an evidence bundle (its directory, or its steps.json) in a fresh browser and say whether its issue happens again. Needs nothing but the bundle, and the secrets it names if any.',
    input: z.object({
      bundle: z.string().describe('A bundle directory or a steps.json path'),
      secrets: z
        .record(z.string())
        .optional()
        .describe(
          'The value of each placeholder of the bundle ({{secret:1}}), typed where the session typed it',
        ),
      cookies: z.array(cookieSchema).optional(),
    }),
    run: (_manager, input) => hauntReplay(input),
  }),
];

export function toolInputJsonSchema(
  tool: ToolDefinition,
): Record<string, unknown> {
  const { $schema, ...schema } = zodToJsonSchema(tool.listing ?? tool.input, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  return schema;
}

// A message a model can act on: which argument is wrong and why.
export function describeInputError(
  toolName: string,
  error: z.ZodError,
): string {
  const problems = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return `Invalid arguments for ${toolName}: ${problems.join('; ')}`;
}
