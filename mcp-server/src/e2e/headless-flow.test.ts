import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runHeadlessTest } from '../cli/headless.js';
import type { ActionDecider } from '../cli/providers/types.js';
import { SessionManager } from '../engine/session/manager.js';
import type { Issue } from '../engine/types.js';
// End-to-end for the haunt-ci loop: runHeadlessTest with a scripted decider in
// place of the LLM, against a real HTTP app. Covers what the decider is shown
// at each step and what ends up in the report — the two ends of the loop that
// a provider-level unit test can't see.
import type { Action } from '../gates/part-1/contract.js';
import {
  type FixtureApp,
  startFixtureApp,
} from '../test-support/fixture-app.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../engine/persona/__fixtures__/valid-persona.yaml',
);
const CONFUSED_BEGINNER = resolve(
  __dirname,
  '../../../personas/confused-beginner.yaml',
);

// What the decider does at one step, given the state it is shown.
interface Turn {
  actions: (state: string) => Action[];
  issues?: Issue[];
}

// The reference a state description gives for an element, found by its name.
function refOf(state: string, name: string): string {
  const match = state.match(new RegExp(`"${name}" \\[(e\\d+)\\]`));
  if (!match) throw new Error(`no element named "${name}" in the state`);
  return match[1];
}
const click =
  (name: string) =>
  (state: string): Action[] => [{ type: 'click', ref: refOf(state, name) }];
const goto = (url: string) => (): Action[] => [{ type: 'goto', url }];

// Replays a fixed list of turns and keeps every state description it was shown.
function scriptedDecider(turns: Turn[]) {
  const seen: string[] = [];
  const decide: ActionDecider = async (_systemPrompt, stateDescription) => {
    const turn = turns[Math.min(seen.length, turns.length - 1)];
    seen.push(stateDescription);
    return {
      actions: turn.actions(stateDescription),
      issues: turn.issues ?? [],
    };
  };
  return { decide, seen };
}

describe('haunt-ci loop against a real app', { timeout: 30_000 }, () => {
  let app: FixtureApp;
  let outsider: FixtureApp;
  let manager: SessionManager;
  const writtenReports: string[] = [];

  beforeAll(async () => {
    [app, outsider] = await Promise.all([startFixtureApp(), startFixtureApp()]);
  });

  afterEach(async () => {
    for (const session of manager?.all() ?? []) {
      await session.browser.close();
    }
  });

  afterAll(async () => {
    await Promise.all([app.close(), outsider.close()]);
    for (const path of writtenReports) {
      rmSync(path, { force: true });
      rmSync(path.replace(/\.md$/, '.json'), { force: true });
    }
  });

  async function run(
    decide: ActionDecider,
    overrides: Partial<Parameters<typeof runHeadlessTest>[2]> = {},
  ) {
    manager = new SessionManager();
    const result = await runHeadlessTest(decide, manager, {
      targetUrl: app.baseUrl,
      personas: [VALID_PERSONA],
      steps: 3,
      headless: true,
      ...overrides,
    });
    writtenReports.push(result.report.report_path);
    return result;
  }

  it('shows the decider each page its previous action led to', async () => {
    const { decide, seen } = scriptedDecider([
      { actions: click('Sign up') },
      { actions: click('Create account') },
      { actions: goto(`${app.baseUrl}/`) },
    ]);

    await run(decide);

    expect(seen).toHaveLength(3);
    expect(seen[0]).toContain(`URL: ${app.baseUrl}/`);
    expect(seen[0]).toContain('Page: Fixture Home');
    expect(seen[0]).toContain('Step 1 of 3');
    expect(seen[0]).toContain('link "Sign up"');

    expect(seen[1]).toContain(`URL: ${app.baseUrl}/signup`);
    expect(seen[1]).toContain('Step 2 of 3');
    expect(seen[1]).toContain('button "Create account"');

    // The empty submission crashed the fixture; the decider gets to see it.
    expect(seen[2]).toContain('Step 3 of 3');
    expect(seen[2]).toContain('Internal Server Error');
  });

  it('tells the decider what its last actions did, failures included', async () => {
    const { decide, seen } = scriptedDecider([
      { actions: click('Sign up') },
      { actions: () => [{ type: 'click', ref: 'e999999' }] },
      { actions: goto(`${app.baseUrl}/`) },
    ]);

    const { report } = await run(decide);

    expect(seen[0]).not.toContain('Your last actions');
    expect(seen[1]).toContain(`1. click: went to ${app.baseUrl}/signup`);
    expect(seen[2]).toContain(
      '1. click: FAILED — No element has the reference e999999',
    );
    // A failed action is information for the decider, not an app issue.
    expect(report.counts.total).toBe(0);
  });

  it('closes every browser and writes the issues the decider reported', async () => {
    const issue: Issue = {
      severity: 'critical',
      category: 'ux',
      description: 'Empty signup returns a 500',
      page_url: `${app.baseUrl}/signup`,
      recommendation: 'Validate the payload',
    };
    const { decide } = scriptedDecider([
      { actions: click('Sign up') },
      { actions: click('Create account') },
      { actions: goto(`${app.baseUrl}/`), issues: [issue] },
    ]);

    const { report, failures } = await run(decide);

    expect(failures).toEqual([]);
    expect(manager.all()).toEqual([]);
    expect(report.counts).toMatchObject({ total: 1, critical: 1 });
    expect(readFileSync(report.report_path, 'utf-8')).toContain(
      '[CRITICAL] Empty signup returns a 500',
    );
  });

  it('runs one session per persona and merges their issues, worst first', async () => {
    const issueFrom = (severity: Issue['severity']): Issue => ({
      severity,
      category: 'ux',
      description: `${severity} finding`,
      page_url: app.baseUrl,
      recommendation: `Fix the ${severity} finding`,
    });
    const decide: ActionDecider = async (systemPrompt) => ({
      actions: [{ type: 'goto', url: `${app.baseUrl}/` }],
      issues: [
        issueFrom(
          systemPrompt.includes('non-technical user') ? 'critical' : 'minor',
        ),
      ],
    });

    const { report } = await run(decide, {
      personas: [VALID_PERSONA, CONFUSED_BEGINNER],
      steps: 1,
    });

    expect(report.counts).toMatchObject({ total: 2, critical: 1, minor: 1 });
    expect(report.summary).toContain('2 areas tested · 2 issues');
    expect(report.top_fix).toBe('Fix the critical finding');
    expect(report.markdown).toContain('Test Persona');
    expect(report.markdown).toContain('Confused Beginner');
    expect(report.markdown.indexOf('critical finding')).toBeLessThan(
      report.markdown.indexOf('minor finding'),
    );
  });

  it('tells the decider when the sandbox blocked its last action, and reports the block', async () => {
    const { decide, seen } = scriptedDecider([
      { actions: goto(`${outsider.baseUrl}/welcome`) },
      { actions: goto(`${app.baseUrl}/`) },
    ]);
    const requestsBefore = outsider.requests.length;

    const { report } = await run(decide, { steps: 2 });

    expect(outsider.requests.length).toBe(requestsBefore);
    expect(seen[0]).not.toContain('blocked by the haunt test sandbox');
    expect(seen[1]).toContain('blocked by the haunt test sandbox');
    expect(seen[1]).toContain(`GET ${outsider.baseUrl}/welcome`);
    // A sandbox block is listed for visibility but is never an issue.
    expect(report.counts.total).toBe(0);
    expect(report.markdown).toContain('## Sandbox-Blocked Requests');
    expect(report.markdown).toContain(`- GET ${outsider.baseUrl}/welcome`);
  });

  it('browses as the logged-in user when given cookies', async () => {
    const { decide, seen } = scriptedDecider([
      { actions: goto(`${app.baseUrl}/`) },
    ]);

    await run(decide, {
      targetUrl: `${app.baseUrl}/welcome`,
      steps: 1,
      cookies: [
        {
          name: 'sid',
          value: 'from-login',
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
    });

    expect(seen[0]).toContain('cookie: sid=from-login');
    expect(seen[0]).not.toContain('you are NOT logged in');
  });

  it('keeps the other personas when one decider call fails', async () => {
    const decide: ActionDecider = async (systemPrompt) => {
      if (systemPrompt.includes('non-technical user')) {
        throw new Error('provider returned 529');
      }
      return {
        actions: [{ type: 'goto', url: `${app.baseUrl}/` }],
        issues: [],
      };
    };

    const { report, failures } = await run(decide, {
      personas: [VALID_PERSONA, CONFUSED_BEGINNER],
      steps: 1,
    });

    expect(failures).toEqual([`${CONFUSED_BEGINNER}: provider returned 529`]);
    expect(report.summary).toContain('1 areas tested');
  });
});
