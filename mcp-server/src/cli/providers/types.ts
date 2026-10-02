// mcp-server/src/cli/providers/types.ts
import { zodToJsonSchema } from 'zod-to-json-schema';
import { actionSchema } from '../../engine/act/schema.js';
import type { Issue } from '../../engine/types.js';
import type { Action } from '../../gates/part-1/contract.js';

export interface ActionDecision {
  // Run in order; the engine stops at the first that fails or changes the
  // page under the rest.
  actions: Action[];
  issues: Issue[];
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
  'Choose the next browser actions to take as this persona, naming elements by the reference shown in the page snapshot (e.g. "e12"), and report any issues observed on the current page state.';

// How many actions one decision may carry.
export const MAX_ACTIONS_PER_STEP = 5;

// Shared JSON Schema for the forced tool call, reused across providers (both
// the Anthropic and Mistral SDKs accept a plain JSON Schema object here). The
// action shapes come from the engine's own definition.
export function decideActionParameters(): Record<string, unknown> {
  const { $schema, ...action } = zodToJsonSchema(actionSchema, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  return {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
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
    required: ['actions'],
  };
}

// Parses a decide_action tool call's raw (already-JSON) input — shared because
// both providers land on the same {actions, issues?} shape once parsed. The
// actions themselves are checked by the engine when they run.
export function parseDecideActionInput(input: unknown): ActionDecision {
  const parsed = input as { actions?: unknown; issues?: Issue[] };
  if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
    throw new Error(
      `${DECIDE_ACTION_TOOL_NAME} tool call was missing "actions"`,
    );
  }
  return {
    actions: parsed.actions.slice(0, MAX_ACTIONS_PER_STEP) as Action[],
    issues: parsed.issues ?? [],
  };
}
