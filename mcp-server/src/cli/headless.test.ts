import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';
import {
  type CliOptions,
  decideAction,
  parseArgs,
  runHeadlessTest,
} from './headless.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../persona/__fixtures__/valid-persona.yaml',
);

describe('parseArgs', () => {
  it('parses the target URL and applies defaults', () => {
    const opts = parseArgs(['http://localhost:3000']);
    expect(opts).toEqual({
      targetUrl: 'http://localhost:3000',
      personas: ['confused-beginner'],
      steps: 3,
      model: 'claude-opus-5',
      headless: true,
    });
  });

  it('parses --personas as a comma-separated list', () => {
    const opts = parseArgs([
      'http://localhost:3000',
      '--personas',
      'confused-beginner,malicious-user',
    ]);
    expect(opts.personas).toEqual(['confused-beginner', 'malicious-user']);
  });

  it('parses --steps, --model, and --headed', () => {
    const opts = parseArgs([
      'http://localhost:3000',
      '--steps',
      '5',
      '--model',
      'claude-haiku-4-5',
      '--headed',
    ]);
    expect(opts.steps).toBe(5);
    expect(opts.model).toBe('claude-haiku-4-5');
    expect(opts.headless).toBe(false);
  });

  it('throws when no URL is given', () => {
    expect(() => parseArgs(['--steps', '3'])).toThrow(/Usage:/);
  });

  it('throws when --steps is not a positive number', () => {
    expect(() => parseArgs(['http://localhost:3000', '--steps', '0'])).toThrow(
      /--steps must be a positive number/,
    );
    expect(() =>
      parseArgs(['http://localhost:3000', '--steps', 'nope']),
    ).toThrow(/--steps must be a positive number/);
  });
});

function mockAnthropic(
  turns: Array<{ action: string; issues?: Issue[] }>,
): Anthropic {
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

describe('decideAction', () => {
  it('reads the action and issues out of the tool_use block', async () => {
    const client = mockAnthropic([
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

    const result = await decideAction(
      client,
      'claude-opus-5',
      'You are...',
      'state',
    );
    expect(result.action).toBe('click Login');
    expect(result.issues).toHaveLength(1);
  });

  it('defaults issues to an empty array when omitted', async () => {
    const client = mockAnthropic([{ action: 'press Enter' }]);
    const result = await decideAction(client, 'claude-opus-5', 'sys', 'state');
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

    await expect(
      decideAction(client, 'claude-opus-5', 'sys', 'state'),
    ).rejects.toThrow(/did not return a decide_action tool call/);
  });
});

describe('runHeadlessTest', () => {
  function baseOptions(overrides: Partial<CliOptions> = {}): CliOptions {
    return {
      targetUrl: 'data:text/html,<input type="text" />',
      personas: [VALID_PERSONA],
      steps: 1,
      model: 'claude-opus-5',
      headless: true,
      ...overrides,
    };
  }

  it('runs a persona session end-to-end and builds the report from its issues', async () => {
    const manager = new SessionManager();
    const client = mockAnthropic([
      {
        // Fast, always-successful action — the point of this test is that a
        // reported issue flows through to the report, not that the action fails.
        action: 'press A',
        issues: [
          {
            severity: 'critical',
            category: 'ux',
            description: 'Something bad',
            page_url: 'data:text/html,<input type="text" />',
            recommendation: 'Fix it',
          },
        ],
      },
    ]);

    const { report, failures } = await runHeadlessTest(
      client,
      manager,
      baseOptions(),
    );

    expect(failures).toEqual([]);
    expect(report.counts.critical).toBe(1);
    expect(report.counts.total).toBe(1);
  }, 15_000);

  it('records a per-persona failure without aborting the whole run', async () => {
    const manager = new SessionManager();
    const client = mockAnthropic([{ action: 'press A' }]);

    const { report, failures } = await runHeadlessTest(client, manager, {
      ...baseOptions(),
      personas: [VALID_PERSONA, '/no/such/persona.yaml'],
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/no/such/persona.yaml');
    expect(report.counts.total).toBe(0);
  }, 15_000);

  it('throws when every persona session fails', async () => {
    const manager = new SessionManager();
    const client = mockAnthropic([{ action: 'press A' }]);

    await expect(
      runHeadlessTest(client, manager, {
        ...baseOptions(),
        personas: ['/no/such/persona.yaml'],
      }),
    ).rejects.toThrow(/All persona sessions failed/);
  });
});
