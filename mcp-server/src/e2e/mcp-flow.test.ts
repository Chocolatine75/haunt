// End-to-end through the MCP protocol: a real client, the real server, a real
// Chromium, and a real HTTP app. This is the path /haunt-test drives — if this
// file passes, a host can run a whole phantom-user session and get a report.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CaptureOutput } from '../engine/capture.js';
import type { EndSessionOutput } from '../engine/end-session.js';
import type { GetCookiesOutput } from '../engine/get-cookies.js';
import type { GenerateReportOutput } from '../engine/report/generate-report.js';
import type { SpawnOutput } from '../engine/spawn.js';
import type { ActResult, Action } from '../gates/part-1/contract.js';
import {
  type FixtureApp,
  startFixtureApp,
} from '../test-support/fixture-app.js';
import {
  type HauntClient,
  connectInMemory,
} from '../test-support/mcp-client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../engine/persona/__fixtures__/valid-persona.yaml',
);

describe('phantom-user session over MCP', { timeout: 30_000 }, () => {
  let app: FixtureApp;
  let outsider: FixtureApp;
  let haunt: HauntClient;
  const openSessions = new Set<string>();
  const writtenReports: string[] = [];

  async function spawn(extra: Record<string, unknown> = {}) {
    const result = await haunt.call<SpawnOutput>('haunt_spawn', {
      persona: VALID_PERSONA,
      target_url: app.baseUrl,
      ...extra,
    });
    expect(result.isError, result.text).toBe(false);
    openSessions.add(result.data.session_id);
    return result.data;
  }

  // The text snapshot, as the orchestrating model reads it.
  async function read(session_id: string) {
    const result = await haunt.call<CaptureOutput>('haunt_capture_state', {
      session_id,
    });
    expect(result.isError, result.text).toBe(false);
    return result.data;
  }

  // The reference the snapshot gives for the element with this name.
  async function ref(session_id: string, name: string): Promise<string> {
    const { text } = await read(session_id);
    const match = text.match(new RegExp(`"${name}" \\[(e\\d+)\\]`));
    if (!match) throw new Error(`no element named "${name}" in:\n${text}`);
    return match[1];
  }

  async function act(
    session_id: string,
    actions: Action[],
    issues?: unknown[],
  ) {
    const result = await haunt.call<ActResult>('haunt_act', {
      session_id,
      actions,
      issues,
    });
    expect(result.isError, result.text).toBe(false);
    return result.data;
  }

  async function end(session_id: string, overall_impression?: string) {
    const result = await haunt.call<EndSessionOutput>('haunt_end_session', {
      session_id,
      overall_impression,
    });
    expect(result.isError, result.text).toBe(false);
    openSessions.delete(session_id);
    return result.data;
  }

  beforeAll(async () => {
    [app, outsider] = await Promise.all([startFixtureApp(), startFixtureApp()]);
    haunt = await connectInMemory();
  });

  afterAll(async () => {
    for (const id of openSessions) {
      await haunt.call('haunt_end_session', { session_id: id });
    }
    await haunt.close();
    await Promise.all([app.close(), outsider.close()]);
    for (const path of writtenReports) {
      rmSync(path, { force: true });
      rmSync(path.replace(/\.md$/, '.json'), { force: true });
    }
  });

  it('runs spawn → capture → act → end → report and finds the planted bug', async () => {
    const session = await spawn();
    expect(session.persona_name).toBe('Test Persona');
    expect(session.persona_goal).toBe('Explore the app');

    const home = await read(session.session_id);
    expect(home.title).toBe('Fixture Home');
    // Route discovery in /haunt-test reads link targets from this snapshot.
    expect(home.text).toMatch(/- link "Sign up" \[e\d+\] -> \/signup/);
    expect(home.screenshot_path).toBeUndefined();

    const toSignup = await act(session.session_id, [
      { type: 'click', ref: await ref(session.session_id, 'Sign up') },
    ]);
    expect(toSignup.results[0]).toMatchObject({
      ok: true,
      changes: { navigated: true, url_after: `${app.baseUrl}/signup` },
    });
    expect(toSignup.step).toBe(1);
    expect(toSignup.steps_remaining).toBe(9);

    // The confused-beginner move: submit the form without filling anything.
    const emptySubmit = await act(session.session_id, [
      { type: 'click', ref: await ref(session.session_id, 'Create account') },
    ]);
    expect(emptySubmit.url).toBe(`${app.baseUrl}/api/signup`);
    expect(app.requests).toContain('POST /api/signup');
    expect((await read(session.session_id)).text).toContain(
      'Internal Server Error',
    );

    const issue = {
      severity: 'critical',
      category: 'ux',
      description: 'Empty signup submission returns a 500',
      page_url: `${app.baseUrl}/signup`,
      recommendation: 'Validate the signup payload server-side',
    };
    await act(
      session.session_id,
      [{ type: 'goto', url: `${app.baseUrl}/` }],
      [issue],
    );

    const ended = await end(session.session_id, 'Signup crashed on me.');
    expect(ended.persona).toBe('Test Persona');
    expect(ended.step_count).toBe(3);
    expect(ended.issues_found).toEqual([issue]);
    expect(ended.sandbox_blocked_requests).toEqual([]);
    expect(ended.overall_impression).toBe('Signup crashed on me.');

    const report = await haunt.call<GenerateReportOutput>(
      'haunt_generate_report',
      {
        target_url: app.baseUrl,
        personas: ['e2e-mcp-flow'],
        sessions: [
          {
            area: '/signup',
            persona: ended.persona,
            overall_impression: ended.overall_impression,
            issues: ended.issues_found,
            sandbox_blocked_requests: ended.sandbox_blocked_requests,
          },
        ],
      },
    );
    expect(report.isError, report.text).toBe(false);
    writtenReports.push(report.data.report_path);

    expect(report.data.counts).toMatchObject({ total: 1, critical: 1 });
    expect(report.data.summary).toContain('1 areas tested · 1 issues');
    expect(report.data.summary).toContain('[!!!] 1 critical');
    expect(existsSync(report.data.report_path)).toBe(true);
    const written = readFileSync(report.data.report_path, 'utf-8');
    expect(written).toBe(report.data.markdown);
    expect(written).toContain(
      '[CRITICAL] Empty signup submission returns a 500',
    );
    expect(written).toContain('## For Claude');
  });

  it('logs in with one call, exports cookies, and reuses them in a fresh session', async () => {
    const login = await spawn({ target_url: `${app.baseUrl}/signup` });
    const submitted = await act(login.session_id, [
      {
        type: 'fill',
        ref: await ref(login.session_id, 'Email'),
        text: 'ghost@example.com',
      },
      {
        type: 'fill',
        ref: await ref(login.session_id, 'Password'),
        text: 'hunter2',
      },
      {
        type: 'click',
        ref: await ref(login.session_id, 'Create account'),
      },
    ]);
    expect(submitted.executed).toBe(3);
    expect(submitted.url).toBe(`${app.baseUrl}/welcome`);
    // Nothing typed into the credential fields comes back.
    expect(JSON.stringify(submitted)).not.toContain('hunter2');

    const cookies = await haunt.call<GetCookiesOutput>('haunt_get_cookies', {
      session_id: login.session_id,
    });
    expect(cookies.data.cookies).toContainEqual(
      expect.objectContaining({
        name: 'sid',
        value: 'fixture-session',
        httpOnly: true,
      }),
    );
    await end(login.session_id);

    const authed = await spawn({
      target_url: `${app.baseUrl}/welcome`,
      cookies: cookies.data.cookies,
    });
    expect((await read(authed.session_id)).text).toContain(
      'sid=fixture-session',
    );
    await end(authed.session_id);
  });

  it('starts every session with a clean cookie jar', async () => {
    const session = await spawn({ target_url: `${app.baseUrl}/welcome` });
    expect((await read(session.session_id)).text).toContain('cookie: none');
    await end(session.session_id);
  });

  it('delivers console and network errors with the action that caused them, once', async () => {
    const session = await spawn();

    const toBroken = await act(session.session_id, [
      { type: 'click', ref: await ref(session.session_id, 'Broken page') },
    ]);
    expect(toBroken.console_errors).toContain('boom from fixture');
    expect(toBroken.network_errors).toEqual([
      expect.stringContaining(`GET ${app.baseUrl}/dead`),
    ]);

    const next = await act(session.session_id, [
      { type: 'goto', url: `${app.baseUrl}/` },
    ]);
    expect(next.console_errors).toEqual([]);
    expect(next.network_errors).toEqual([]);
    await end(session.session_id);
  });

  it('reports a failed action as a result, and files no issue for it', async () => {
    const session = await spawn();
    const failed = await act(session.session_id, [
      { type: 'click', ref: 'e999999' },
    ]);
    expect(failed.results[0]).toMatchObject({
      ok: false,
      error: { code: 'unknown_ref' },
    });
    expect(failed.stopped).toBe('failed');

    const ended = await end(session.session_id);
    expect(ended.issues_found).toEqual([]);
  });

  it('blocks navigation to another origin and never files it as an app issue', async () => {
    const session = await spawn();
    const requestsBefore = outsider.requests.length;

    const blocked = await act(session.session_id, [
      { type: 'goto', url: `${outsider.baseUrl}/welcome?token=secret` },
    ]);
    expect(blocked.results[0].error).toMatchObject({
      code: 'sandbox_blocked',
      blocked: `GET ${outsider.baseUrl}/welcome`,
    });
    expect(blocked.sandbox_blocked).toEqual([
      `GET ${outsider.baseUrl}/welcome`,
    ]);
    // Blocked, not merely recorded: the other origin never saw the request.
    expect(outsider.requests.length).toBe(requestsBefore);

    const ended = await end(session.session_id);
    expect(ended.issues_found).toEqual([]);
    expect(ended.sandbox_blocked_requests).toEqual([
      `GET ${outsider.baseUrl}/welcome`,
    ]);
  });

  it('enforces the step budget across the protocol', async () => {
    const session = await spawn({ timeout: 1 });
    const first = await act(session.session_id, [
      { type: 'goto', url: `${app.baseUrl}/` },
    ]);
    expect(first.steps_remaining).toBe(0);

    const second = await haunt.call('haunt_act', {
      session_id: session.session_id,
      actions: [{ type: 'goto', url: `${app.baseUrl}/` }],
    });
    expect(second.isError).toBe(true);
    expect(second.text).toMatch(/hit its step limit \(1\)/);

    // The session is still there to be ended, and unusable afterwards.
    await end(session.session_id);
    const gone = await haunt.call('haunt_capture_state', {
      session_id: session.session_id,
    });
    expect(gone.isError).toBe(true);
  });

  it('runs several sessions in parallel without mixing their state', async () => {
    const [a, b] = await Promise.all([
      spawn({ target_url: `${app.baseUrl}/signup` }),
      spawn({ target_url: `${app.baseUrl}/welcome` }),
    ]);
    expect(a.session_id).not.toBe(b.session_id);

    const [stateA, stateB] = await Promise.all([
      read(a.session_id),
      read(b.session_id),
    ]);
    expect(stateA.title).toBe('Fixture Signup');
    expect(stateB.title).toBe('Fixture Welcome');

    await act(a.session_id, [{ type: 'goto', url: `${app.baseUrl}/` }]);
    const [endedA, endedB] = await Promise.all([
      end(a.session_id),
      end(b.session_id),
    ]);
    expect(endedA.step_count).toBe(1);
    expect(endedB.step_count).toBe(0);
  });
});
