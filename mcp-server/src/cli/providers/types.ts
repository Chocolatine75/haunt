// mcp-server/src/cli/providers/types.ts
import { zodToJsonSchema } from 'zod-to-json-schema';
import { actionSchema } from '../../engine/act/schema.js';
import { expectationSchema, planCaseSchema } from '../../engine/plan/schema.js';
import type { Issue } from '../../engine/types.js';
import type { Action } from '../../gates/part-1/contract.js';
import type { Expectation, PlanCase } from '../../gates/part-4/contract.js';

export interface ActionDecision {
  // Run in order; the engine stops at the first that fails or changes the
  // page under the rest.
  actions: Action[];
  issues: Issue[];
  // A plan, when asked for one; then the case the actions play and what is
  // expected once they have run (part 4, R-T23).
  cases?: PlanCase[];
  case?: string;
  expect?: Expectation;
}

// One call = one step: given the persona's system prompt and a description of
// the current page state, decide the next browser actions (and any issues
// observed).
export type ActionDecider = (
  systemPrompt: string,
  stateDescription: string,
) => Promise<ActionDecision>;

export const DECIDE_ACTION_TOOL_NAME = 'decide_action';

export const DECIDE_ACTION_TOOL_DESCRIPTION =
  'Answer as the role you were given. As the planner: the test cases, in "cases". As the tester: the next browser actions, naming elements by the reference shown in the page snapshot (e.g. "e12"), with the case they play and what you expect of them, and the issues you have found.';

// How many actions one decision may carry.
export const MAX_ACTIONS_PER_STEP = 5;

// Shared JSON Schema for the forced tool call, reused across providers (both
// the Anthropic and Mistral SDKs accept a plain JSON Schema object here). The
// action shapes come from the engine's own definition.
export function decideActionParameters(): Record<string, unknown> {
  const { $schema, ...action } = zodToJsonSchema(actionSchema, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  const schemaOf = (schema: Parameters<typeof zodToJsonSchema>[0]) => {
    const { $schema: _, ...rest } = zodToJsonSchema(schema, {
      $refStrategy: 'none',
    }) as Record<string, unknown>;
    return rest;
  };
  return {
    type: 'object',
    properties: {
      cases: {
        type: 'array',
        description:
          'Only when asked for a plan: the test cases, each control by its reference from the inventory.',
        items: schemaOf(planCaseSchema),
      },
      case: {
        type: 'string',
        description:
          'The id of the case these actions play. With "expect", the engine checks it and gives the case its verdict.',
      },
      expect: {
        ...schemaOf(expectationSchema),
        description:
          'What you expect once these actions have run, stated before you see the result: exactly one of list, value, text_present, text_absent, url, element.',
      },
      actions: {
        type: 'array',
        maxItems: MAX_ACTIONS_PER_STEP,
        description:
          'Usually one action. Several only when the later ones do not depend on what the earlier ones do to the page (filling the fields of one form, for instance).',
        items: action,
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['critical', 'major', 'minor', 'suggestion'],
            },
            category: {
              type: 'string',
              enum: [
                'ux',
                'accessibility',
                'performance',
                'security',
                'content',
              ],
            },
            description: { type: 'string' },
            page_url: { type: 'string' },
            recommendation: { type: 'string' },
            signal: {
              type: 'string',
              description:
                'The id of the detected signal this issue is about (s3)',
            },
            case: {
              type: 'string',
              description:
                'The id of the case whose expectation did not hold: the engine replays it',
            },
            expected: {
              type: 'string',
              description: 'For what no check can state: what you expected',
            },
            actual: { type: 'string', description: 'And what you saw' },
            observed: {
              type: 'object',
              description:
                'For an issue no signal shows: one fact about the page the engine can check',
              properties: {
                step: { type: 'integer' },
                text_present: { type: 'string' },
                text_absent: { type: 'string' },
                url: { type: 'string' },
                element: {
                  type: 'object',
                  properties: {
                    ref: { type: 'string' },
                    state: {
                      type: 'string',
                      enum: [
                        'visible',
                        'hidden',
                        'disabled',
                        'enabled',
                        'gone',
                      ],
                    },
                  },
                  required: ['ref', 'state'],
                },
              },
            },
          },
          required: [
            'severity',
            'category',
            'description',
            'page_url',
            'recommendation',
          ],
        },
      },
    },
    required: [],
  };
}

// Parses a decide_action tool call's raw (already-JSON) input — shared because
// both providers land on the same {actions, issues?} shape once parsed. The
// actions themselves are checked by the engine when they run.
export function parseDecideActionInput(input: unknown): ActionDecision {
  const parsed = (input ?? {}) as {
    actions?: unknown;
    issues?: unknown;
    cases?: unknown;
    case?: unknown;
    expect?: unknown;
  };
  // No actions is a legitimate answer ("nothing more to do here"), and the
  // only one expected at the end of a session.
  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  return {
    actions: actions.slice(0, MAX_ACTIONS_PER_STEP) as Action[],
    issues: Array.isArray(parsed.issues) ? (parsed.issues as Issue[]) : [],
    // Checked by the engine when they are registered or stated.
    ...(Array.isArray(parsed.cases) && parsed.cases.length > 0
      ? { cases: parsed.cases as PlanCase[] }
      : {}),
    ...(typeof parsed.case === 'string' ? { case: parsed.case } : {}),
    ...(parsed.expect && typeof parsed.expect === 'object'
      ? { expect: parsed.expect as Expectation }
      : {}),
  };
}
