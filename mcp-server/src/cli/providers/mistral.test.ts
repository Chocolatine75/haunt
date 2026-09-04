import type { Mistral } from '@mistralai/mistralai';
import { describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types.js';
import { createMistralDecider } from './mistral.js';

function mockClient(
  turns: Array<{ action: string; issues?: Issue[] } | string>,
): Mistral {
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
        action: 'click Login',
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
    expect(result.action).toBe('click Login');
    expect(result.issues).toHaveLength(1);
  });

  it('parses arguments when the SDK returns them as a JSON string', async () => {
    const client = mockClient([JSON.stringify({ action: 'press Enter' })]);
    const decide = createMistralDecider(client, 'mistral-small-latest');

    const result = await decide('sys', 'state');
    expect(result.action).toBe('press Enter');
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
    const client = mockClient([{ action: 'press Enter' }]);
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
