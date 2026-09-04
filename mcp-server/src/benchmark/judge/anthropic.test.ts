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
      matched: [
        {
          ground_truth_id: 'bug-1',
          matched_issue_description: 'X is definitely broken',
        },
      ],
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
