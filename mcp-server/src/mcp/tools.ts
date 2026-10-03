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
import { hauntEndSession } from '../engine/end-session.js';
import { hauntGetCookies } from '../engine/get-cookies.js';
import { hauntEstimateCost } from '../engine/report/estimate-cost.js';
import { hauntGenerateReport } from '../engine/report/generate-report.js';
import type { SessionManager } from '../engine/session/manager.js';
import { hauntSpawn } from '../engine/spawn.js';

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
});

const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
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

export const TOOLS: ToolDefinition[] = [
  defineTool({
    name: 'haunt_spawn',
    description:
      'Open a browser session for a persona and navigate to the target URL. Returns persona details (name, goal, system prompt) so the orchestrator can roleplay as that persona.',
    input: z.object({
      persona: z
        .string()
        .describe(
          'Persona name (e.g. confused-beginner) or absolute path to a YAML file',
        ),
      target_url: z
        .string()
        .describe('URL to test (e.g. http://localhost:3000)'),
      headless: z
        .boolean()
        .optional()
        .describe('Run browser in headless mode. Default: true'),
      timeout: z
        .number()
        .optional()
        .describe('Maximum navigation steps for this session. Default: 30'),
      cookies: z
        .array(cookieSchema)
        .optional()
        .describe(
          'Session cookies to inject before navigation (for authenticated testing)',
        ),
    }),
    run: (manager, input) => hauntSpawn(manager, input),
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
    }),
    run: (manager, input) => hauntAct(manager, input),
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
    }),
    run: (manager, input) => hauntCaptureState(manager, input),
  }),
  defineTool({
    name: 'haunt_end_session',
    description:
      'Close the browser session and return the structured report of all issues found.',
    input: z.object({
      session_id: z.string(),
      overall_impression: z
        .string()
        .optional()
        .describe(
          "The orchestrator's summary of the session from the persona's perspective",
        ),
      issues: z
        .array(issueSchema)
        .optional()
        .describe(
          'Issues found since the last haunt_act call, typically from the result of the last action',
        ),
    }),
    run: (manager, input) => hauntEndSession(manager, input),
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
      personas: z.array(z.string()).describe('Persona names used in this run'),
      sessions: z
        .array(
          z.object({
            area: z
              .string()
              .describe('The route/area this session tested, e.g. /signup'),
            persona: z.string(),
            overall_impression: z.string(),
            issues: z
              .array(issueSchema)
              .describe("This session's EndSessionOutput.issues_found"),
            sandbox_blocked_requests: z
              .array(z.string())
              .optional()
              .describe(
                "This session's EndSessionOutput.sandbox_blocked_requests",
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
    run: (_manager, input) => hauntGenerateReport(input),
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
