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

    // Three steps, then the wrap-up question.
    expect(seen).toHaveLength(4);
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

  it('asks once more after the last step, and records what that answer reports', async () => {
    const late: Issue = {
      severity: 'major',
      category: 'ux',
      description: 'Seen only in the result of the last action',
      page_url: `${app.baseUrl}/signup`,
      recommendation: 'Show an error',
      // Checkable, so that a replay confirms it (part 3).
      observed: { url: '/signup' },
    };
    const seen: string[] = [];
    const decide: ActionDecider = async (_system, state) => {
      seen.push(state);
      const wrapUp = state.includes('The session is over');
      return {
        actions: wrapUp
          ? [{ type: 'goto', url: `${app.baseUrl}/never-visited` }]
          : [{ type: 'goto', url: `${app.baseUrl}/signup` }],
        issues: wrapUp ? [late] : [],
      };
    };

    const requestsBefore = app.requests.length;
    const { report } = await run(decide, { steps: 1 });

    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain('Your last actions');
    expect(seen[1]).toContain('The session is over');
    expect(report.counts).toMatchObject({ total: 1, major: 1 });
    // The wrap-up answer's actions are not run. (GET /signup is not counted:
    // the replays that verify the issue load it too.)
    expect(app.requests.slice(requestsBefore)).not.toContain(
      'GET /never-visited',
    );
  });

  it('keeps what a session found when its last answer fails or carries no action', async () => {
    const found: Issue = {
      severity: 'major',
      category: 'ux',
      description: 'Found during the session',
      page_url: app.baseUrl,
      recommendation: 'Fix it',
      observed: { text_absent: 'Nothing on this page says this' },
    };
    let calls = 0;
    const decide: ActionDecider = async (_system, state) => {
      calls++;
      if (state.includes('The session is over')) {
        throw new Error('provider returned 529');
      }
      // Step 1 acts and reports; step 2 has nothing more to do.
      return calls === 1
        ? {
            actions: [{ type: 'goto', url: `${app.baseUrl}/` }],
            issues: [found],
          }
        : { actions: [], issues: [] };
    };

    const { report, failures } = await run(decide, { steps: 2 });

    expect(failures).toEqual([]);
    expect(report.counts).toMatchObject({ total: 1, major: 1 });
    expect(manager.all()).toEqual([]);
  });

  it('prints each decision and its outcome when verbose', async () => {
    const { decide } = scriptedDecider([
      { actions: click('Sign up') },
      // The wrap-up answer; its action is not run.
      { actions: () => [{ type: 'read' }] },
    ]);
    const lines: string[] = [];
    const original = console.error;
    console.error = (line: string) => lines.push(String(line));
    try {
      await run(decide, { steps: 1, verbose: true });
    } finally {
      console.error = original;
    }
    const printed = lines.join('\n');
    // The plan is asked for first; this decider gives none.
    expect(printed).toContain('[plan] 0 case(s)');
    expect(printed).toMatch(/step 1: \[\{"type":"click","ref":"e\d+"\}\]/);
    expect(printed).toContain(`1. click: went to ${app.baseUrl}/signup`);
    expect(printed).toContain('wrap-up: 0 more issue(s)');
  });

  it('closes every browser and writes the issues the decider reported', async () => {
    const issue: Issue = {
      severity: 'critical',
      category: 'ux',
      description: 'Empty signup returns a 500',
      page_url: `${app.baseUrl}/signup`,
      recommendation: 'Validate the payload',
      observed: { text_absent: 'Account created' },
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

  // Was: one session per persona, their issues merged. There is one session
  // on the URL now (part 4, R-T14); what remains to hold is that its issues
  // come out worst first, and that no persona is named.
  it("reports a session's issues worst first, and names no persona", async () => {
    const issueFrom = (severity: Issue['severity']): Issue => ({
      severity,
      category: 'ux',
      description: `${severity} finding`,
      page_url: app.baseUrl,
      recommendation: `Fix the ${severity} finding`,
      observed: { text_absent: 'Nothing on this page says this' },
    });
    let asked = 0;
    const decide: ActionDecider = async () => ({
      actions: [{ type: 'goto', url: `${app.baseUrl}/` }],
      issues: ++asked === 1 ? [issueFrom('minor'), issueFrom('critical')] : [],
    });

    const { report } = await run(decide, {
      personas: [VALID_PERSONA, CONFUSED_BEGINNER],
      steps: 1,
    });

    expect(report.counts).toMatchObject({ total: 2, critical: 1, minor: 1 });
    expect(report.summary).toContain('1 areas tested · 2 issues');
    expect(report.top_fix).toBe('Fix the critical finding');
    // The report no longer says which persona found what: they are gone
    // from it (part 4, R-T14).
    expect(report.markdown).not.toContain('Test Persona');
    expect(report.markdown).not.toContain('Confused Beginner');
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

  // Was: one persona's failed decider call leaves the other personas' run
  // standing. With one session there is no other: the failure is the run's,
  // and it leaves no browser behind.
  it('fails the run when the decider fails, and closes the browser', async () => {
    const decide: ActionDecider = async () => {
      throw new Error('provider returned 529');
    };
    manager = new SessionManager();
    await expect(
      runHeadlessTest(decide, manager, {
        targetUrl: app.baseUrl,
        steps: 1,
        headless: true,
      }),
    ).rejects.toThrow(/All sessions failed: .*provider returned 529/);
    expect(manager.all()).toEqual([]);
  });
});
