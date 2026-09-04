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
