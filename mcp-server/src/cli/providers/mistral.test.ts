import type { Mistral } from '@mistralai/mistralai';
import { describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../engine/types.js';
import { createMistralDecider } from './mistral.js';

function mockClient(turns: unknown[]): Mistral {
  let call = 0;
  const complete = vi.fn(async () => {
    const turn = turns[Math.min(call, turns.length - 1)];
    call++;
    return {
      choices: [
        {
          index: 0,
          finishReason: 'tool_calls',
          message: {
            role: 'assistant',
            toolCalls: [
              {
                id: `call_${call}`,
                type: 'function',
                function: {
                  name: 'decide_action',
                  // Mistral's SDK types arguments as object | string — exercise both.
                  arguments: turn,
                },
              },
            ],
          },
        },
      ],
    };
  });
  return { chat: { complete } } as unknown as Mistral;
}

describe('createMistralDecider', () => {
  it('reads the action and issues out of an object-typed tool call', async () => {
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
    const decide = createMistralDecider(client, 'mistral-small-latest');

    const result = await decide('You are...', 'state');
    expect(result.actions).toEqual([{ type: 'click', ref: 'e1' }]);
    expect(result.issues).toHaveLength(1);
  });

  it('parses arguments when the SDK returns them as a JSON string', async () => {
    const client = mockClient([
      JSON.stringify({ actions: [{ type: 'press', keys: 'Enter' }] }),
    ]);
    const decide = createMistralDecider(client, 'mistral-small-latest');

    const result = await decide('sys', 'state');
    expect(result.actions).toEqual([{ type: 'press', keys: 'Enter' }]);
    expect(result.issues).toEqual([]);
  });

  it('throws when the model returns no tool call', async () => {
    const client = {
      chat: {
        complete: vi.fn(async () => ({
          choices: [
            {
              index: 0,
              finishReason: 'stop',
              message: { role: 'assistant', content: 'I refuse' },
            },
          ],
        })),
      },
    } as unknown as Mistral;
    const decide = createMistralDecider(client, 'mistral-small-latest');

    await expect(decide('sys', 'state')).rejects.toThrow(
      /did not return a decide_action tool call/,
    );
  });

  it('calls the SDK with the model, forced toolChoice, and a system message', async () => {
    const client = mockClient([
      { actions: [{ type: 'press', keys: 'Enter' }] },
    ]);
    const decide = createMistralDecider(client, 'mistral-small-latest');

    await decide('You are a confused beginner', 'URL: /signup');

    expect(client.chat.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mistral-small-latest',
        toolChoice: { type: 'function', function: { name: 'decide_action' } },
        messages: [
          { role: 'system', content: 'You are a confused beginner' },
          { role: 'user', content: 'URL: /signup' },
        ],
      }),
    );
  });
});
