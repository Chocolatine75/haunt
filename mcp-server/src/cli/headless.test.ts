import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SessionManager } from '../engine/session/manager.js';
import type { Issue } from '../engine/types.js';
import {
  type CliOptions,
  parseArgs,
  resolveProvider,
  runHeadlessTest,
} from './headless.js';
import type { ActionDecider } from './providers/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../engine/persona/__fixtures__/valid-persona.yaml',
);

describe('parseArgs', () => {
  it('parses the target URL and applies defaults', () => {
    const opts = parseArgs(['http://localhost:3000']);
    expect(opts).toEqual({
      targetUrl: 'http://localhost:3000',
      personas: ['confused-beginner'],
      steps: 3,
      provider: undefined,
      model: undefined,
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

  it('parses --steps, --provider, --model, and --headed', () => {
    const opts = parseArgs([
      'http://localhost:3000',
      '--steps',
      '5',
      '--provider',
      'mistral',
      '--model',
      'mistral-small-latest',
      '--headed',
    ]);
    expect(opts.steps).toBe(5);
    expect(opts.provider).toBe('mistral');
    expect(opts.model).toBe('mistral-small-latest');
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

  it('throws on an unknown --provider value', () => {
    expect(() =>
      parseArgs(['http://localhost:3000', '--provider', 'openai']),
    ).toThrow(/--provider must be "anthropic" or "mistral"/);
  });

  it('parses --email, --password, and --login-url', () => {
    const opts = parseArgs([
      'http://localhost:3000',
      '--email',
      'test@example.com',
      '--password',
      'password123',
      '--login-url',
      'http://localhost:3000/auth/login',
    ]);
    expect(opts.email).toBe('test@example.com');
    expect(opts.password).toBe('password123');
    expect(opts.loginUrl).toBe('http://localhost:3000/auth/login');
  });

  it('throws when only --email is given without --password', () => {
    expect(() =>
      parseArgs(['http://localhost:3000', '--email', 'test@example.com']),
    ).toThrow(/--email and --password must be given together/);
  });

  it('throws when only --password is given without --email', () => {
    expect(() =>
      parseArgs(['http://localhost:3000', '--password', 'password123']),
    ).toThrow(/--email and --password must be given together/);
  });
});

describe('resolveProvider', () => {
  it('auto-detects anthropic when only ANTHROPIC_API_KEY is set', () => {
    const resolved = resolveProvider(
      { provider: undefined, model: undefined },
      { ANTHROPIC_API_KEY: 'sk-ant-x' },
    );
    expect(resolved).toEqual({ provider: 'anthropic', model: 'claude-opus-5' });
  });

  it('auto-detects mistral when only MISTRAL_API_KEY is set', () => {
    const resolved = resolveProvider(
      { provider: undefined, model: undefined },
      { MISTRAL_API_KEY: 'mistral-x' },
    );
    expect(resolved).toEqual({
      provider: 'mistral',
      model: 'mistral-small-latest',
    });
  });

  it('prefers anthropic when both keys are set and no --provider given', () => {
    const resolved = resolveProvider(
      { provider: undefined, model: undefined },
      { ANTHROPIC_API_KEY: 'sk-ant-x', MISTRAL_API_KEY: 'mistral-x' },
    );
    expect(resolved.provider).toBe('anthropic');
  });

  it('respects an explicit --provider even if the other key is also set', () => {
    const resolved = resolveProvider(
      { provider: 'mistral', model: undefined },
      { ANTHROPIC_API_KEY: 'sk-ant-x', MISTRAL_API_KEY: 'mistral-x' },
    );
    expect(resolved.provider).toBe('mistral');
  });

  it('throws when no key is available at all', () => {
    expect(() =>
      resolveProvider({ provider: undefined, model: undefined }, {}),
    ).toThrow(/No API key found/);
  });

  it('throws when --provider is given but its key is missing', () => {
    expect(() =>
      resolveProvider({ provider: 'mistral', model: undefined }, {}),
    ).toThrow(/requires MISTRAL_API_KEY/);
  });

  it('lets --model and HAUNT_CI_MODEL override the provider default, in that order', () => {
    expect(
      resolveProvider(
        { provider: 'mistral', model: 'ministral-3b-latest' },
        { MISTRAL_API_KEY: 'x', HAUNT_CI_MODEL: 'mistral-large-latest' },
      ).model,
    ).toBe('ministral-3b-latest');

    expect(
      resolveProvider(
        { provider: 'mistral', model: undefined },
        { MISTRAL_API_KEY: 'x', HAUNT_CI_MODEL: 'mistral-large-latest' },
      ).model,
    ).toBe('mistral-large-latest');
  });
});

describe('runHeadlessTest', () => {
  function baseOptions(
    overrides: Partial<
      Pick<CliOptions, 'targetUrl' | 'personas' | 'steps' | 'headless'>
    > = {},
  ) {
    return {
      targetUrl: 'data:text/html,<input type="text" />',
      personas: [VALID_PERSONA],
      steps: 1,
      headless: true,
      ...overrides,
    };
  }

  function fakeDecider(
    turns: Array<{ action: string; issues?: Issue[] }>,
  ): ActionDecider {
    let call = 0;
    return async () => {
      const turn = turns[Math.min(call, turns.length - 1)];
      call++;
      return { action: turn.action, issues: turn.issues ?? [] };
    };
  }

  it('runs a persona session end-to-end and builds the report from its issues', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider([
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
      decide,
      manager,
      baseOptions(),
    );

    expect(failures).toEqual([]);
    expect(report.counts.critical).toBe(1);
    expect(report.counts.total).toBe(1);
  }, 15_000);

  it('records a per-persona failure without aborting the whole run', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider([{ action: 'press A' }]);

    const { report, failures } = await runHeadlessTest(decide, manager, {
      ...baseOptions(),
      personas: [VALID_PERSONA, '/no/such/persona.yaml'],
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/no/such/persona.yaml');
    expect(report.counts.total).toBe(0);
  }, 15_000);

  it('throws when every persona session fails', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider([{ action: 'press A' }]);

    await expect(
      runHeadlessTest(decide, manager, {
        ...baseOptions(),
        personas: ['/no/such/persona.yaml'],
      }),
    ).rejects.toThrow(/All persona sessions failed/);
  });

  it('tells the persona it is unauthenticated when no cookies are given', async () => {
    const manager = new SessionManager();
    const stateDescriptions: string[] = [];
    const decide: ActionDecider = async (_persona, state) => {
      stateDescriptions.push(state);
      return { action: 'press A', issues: [] };
    };

    await runHeadlessTest(decide, manager, baseOptions());

    expect(stateDescriptions[0]).toContain('you are NOT logged in');
  }, 15_000);

  it('omits the unauthenticated note when cookies are provided', async () => {
    const manager = new SessionManager();
    const stateDescriptions: string[] = [];
    const decide: ActionDecider = async (_persona, state) => {
      stateDescriptions.push(state);
      return { action: 'press A', issues: [] };
    };

    await runHeadlessTest(decide, manager, {
      ...baseOptions(),
      cookies: [
        {
          name: 'session',
          value: 'abc',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
    });

    expect(stateDescriptions[0]).not.toContain('you are NOT logged in');
  }, 15_000);
});
