import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../engine/types.js';
import { createAnthropicDecider } from './anthropic.js';

function mockClient(turns: unknown[]): Anthropic {
  let call = 0;
  const create = vi.fn(async () => {
    const turn = turns[Math.min(call, turns.length - 1)];
    call++;
    return {
      content: [
        {
          type: 'tool_use',
          id: `toolu_${call}`,
          name: 'decide_action',
          input: turn,
        },
      ],
      stop_reason: 'tool_use',
    };
  });
  return { messages: { create } } as unknown as Anthropic;
}

describe('createAnthropicDecider', () => {
  it('reads the action and issues out of the tool_use block', async () => {
    const client = mockClient([
      {
        actions: [{ type: 'click', ref: 'e1' }],
        issues: [
          {
            severity: 'minor',
            category: 'ux',
            description: 'small thing',
            page_url: '/x',
            recommendation: 'fix it',
          },
        ],
      },
    ]);
    const decide = createAnthropicDecider(client, 'claude-opus-5');

    const result = await decide('You are...', 'state');
    expect(result.actions).toEqual([{ type: 'click', ref: 'e1' }]);
    expect(result.issues).toHaveLength(1);
  });

  it('defaults issues to an empty array when omitted', async () => {
    const client = mockClient([
      { actions: [{ type: 'press', keys: 'Enter' }] },
    ]);
    const decide = createAnthropicDecider(client, 'claude-opus-5');

    const result = await decide('sys', 'state');
    expect(result.issues).toEqual([]);
  });

  it('throws when the model returns no tool_use block', async () => {
    const client = {
      messages: {
        create: vi.fn(async () => ({
          content: [{ type: 'text', text: 'I refuse' }],
          stop_reason: 'end_turn',
        })),
      },
    } as unknown as Anthropic;
    const decide = createAnthropicDecider(client, 'claude-opus-5');

    await expect(decide('sys', 'state')).rejects.toThrow(
      /did not return a decide_action tool call/,
    );
  });

  it('calls the SDK with the model, forced tool_choice, and system prompt', async () => {
    const client = mockClient([
      { actions: [{ type: 'press', keys: 'Enter' }] },
    ]);
    const decide = createAnthropicDecider(client, 'claude-opus-5');

    await decide('You are a confused beginner', 'URL: /signup');

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5',
        system: 'You are a confused beginner',
        tool_choice: { type: 'tool', name: 'decide_action' },
      }),
    );
  });
});
