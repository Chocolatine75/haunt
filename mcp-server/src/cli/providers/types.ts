// mcp-server/src/cli/providers/types.ts
import type { Issue } from '../../engine/types.js';

export interface ActionDecision {
  action: string;
  issues: Issue[];
}

// One call = one step: given the persona's system prompt and a description of the
// current page state, decide the next browser action (and any issues observed).
export type ActionDecider = (
  systemPrompt: string,
  stateDescription: string,
) => Promise<ActionDecision>;

export const DECIDE_ACTION_TOOL_NAME = 'decide_action';

export const DECIDE_ACTION_TOOL_DESCRIPTION =
  'Choose the single next browser action to take as this persona, and report any issues observed on the current page state.';

// Shared JSON Schema for the forced tool call, reused across providers (both the
// Anthropic and Mistral SDKs accept a plain JSON Schema object here).
export function decideActionParameters(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'Natural-language action: "click <target>", "fill <text> in <field>", "goto <url>", or "press <key>"',
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
    required: ['action'],
  };
}

// Parses a decide_action tool call's raw (already-JSON) input — shared because
// both providers land on the same {action, issues?} shape once parsed.
export function parseDecideActionInput(input: unknown): ActionDecision {
  const parsed = input as { action?: string; issues?: Issue[] };
  if (!parsed.action) {
    throw new Error(
      `${DECIDE_ACTION_TOOL_NAME} tool call was missing "action"`,
    );
  }
  return { action: parsed.action, issues: parsed.issues ?? [] };
}
