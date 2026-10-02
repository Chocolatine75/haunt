// End-to-end through the MCP protocol: a real client, the real server, a real
// Chromium, and a real HTTP app. This is the path /haunt-test drives — if this
// file passes, a host can run a whole phantom-user session and get a report.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type FixtureApp,
  startFixtureApp,
} from '../test-support/fixture-app.js';
import {
  type HauntClient,
  connectInMemory,
} from '../test-support/mcp-client.js';
import type { CaptureOutput } from '../tools/capture.js';
import type { EndSessionOutput } from '../tools/end-session.js';
import type { GenerateReportOutput } from '../tools/generate-report.js';
import type { GetCookiesOutput } from '../tools/get-cookies.js';
import {
  type NavigateOutput,
  SANDBOX_BLOCK_PREFIX,
} from '../tools/navigate.js';
import type { SpawnOutput } from '../tools/spawn.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../persona/__fixtures__/valid-persona.yaml',
);

describe('phantom-user session over MCP', () => {
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

  async function navigate(
    session_id: string,
    action: string,
    issues?: unknown[],
  ) {
    const result = await haunt.call<NavigateOutput>('haunt_navigate', {
      session_id,
      action,
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

  it('runs spawn → capture → navigate → end → report and finds the planted bug', async () => {
    const session = await spawn();
    expect(session.persona_name).toBe('Test Persona');
    expect(session.persona_goal).toBe('Explore the app');

    const home = await haunt.call<CaptureOutput>('haunt_capture_state', {
      session_id: session.session_id,
      include_screenshot: false,
      include_dom: true,
    });
    expect(home.data.title).toBe('Fixture Home');
    expect(home.data.accessibility_tree).toContain('Sign up');
    // Route discovery in /haunt-test reads hrefs from this snapshot.
    expect(home.data.dom_snapshot).toContain('href="/signup"');
    expect(home.data.screenshot_path).toBeUndefined();

    const toSignup = await navigate(session.session_id, 'click Sign up');
    expect(toSignup.success).toBe(true);
    expect(toSignup.page_url).toBe(`${app.baseUrl}/signup`);
    expect(toSignup.step).toBe(1);
    expect(toSignup.steps_remaining).toBe(9);

    // The confused-beginner move: submit the form without filling anything.
    const emptySubmit = await navigate(
      session.session_id,
      'click Create account',
    );
    expect(emptySubmit.success).toBe(true);
    expect(emptySubmit.page_url).toBe(`${app.baseUrl}/api/signup`);
    expect(app.requests).toContain('POST /api/signup');

    const crashed = await haunt.call<CaptureOutput>('haunt_capture_state', {
      session_id: session.session_id,
      include_screenshot: false,
    });
    expect(crashed.data.accessibility_tree).toContain('Internal Server Error');

    const issue = {
      severity: 'critical',
      category: 'ux',
      description: 'Empty signup submission returns a 500',
      page_url: `${app.baseUrl}/signup`,
      recommendation: 'Validate the signup payload server-side',
    };
    await navigate(session.session_id, `goto ${app.baseUrl}/`, [issue]);

    const ended = await end(session.session_id, 'Signup crashed on me.');
    expect(ended.persona).toBe('Test Persona');
    expect(ended.step_count).toBe(3);
    expect(ended.pages_visited).toBe(4);
    expect(ended.issues_found).toEqual([issue]);
    expect(ended.sandbox_blocked_requests).toEqual([]);
    expect(ended.overall_impression).toBe('Signup crashed on me.');

    const report = await haunt.call<GenerateReportOutput>(
      'haunt_generate_report',
      {
        target_url: app.baseUrl,
        personas: ['e2e-mcp-flow'],
        date: '1999-01-01',
        sessions: [
          {
            area: '/signup',
            persona: ended.persona,
            overall_impression: ended.overall_impression,
            issues: ended.issues_found,
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

  it('logs in, exports cookies, and reuses them in a fresh session', async () => {
    const login = await spawn({ target_url: `${app.baseUrl}/signup` });
    await navigate(login.session_id, 'fill ghost@example.com in Email');
    await navigate(login.session_id, 'fill hunter2 in Password');
    const submitted = await navigate(login.session_id, 'click Create account');
    expect(submitted.page_url).toBe(`${app.baseUrl}/welcome`);

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
    const state = await haunt.call<CaptureOutput>('haunt_capture_state', {
      session_id: authed.session_id,
      include_screenshot: false,
    });
    expect(state.data.accessibility_tree).toContain('sid=fixture-session');
    await end(authed.session_id);
  });

  it('starts every session with a clean cookie jar', async () => {
    const session = await spawn({ target_url: `${app.baseUrl}/welcome` });
    const state = await haunt.call<CaptureOutput>('haunt_capture_state', {
      session_id: session.session_id,
      include_screenshot: false,
    });
    expect(state.data.accessibility_tree).toContain('cookie: none');
    await end(session.session_id);
  });

  it('hands console and network errors to the next step, once', async () => {
    // Spawning directly on the page means its load has settled (and its errors
    // have been captured) before the first step drains them.
    const session = await spawn({ target_url: `${app.baseUrl}/broken` });

    const first = await navigate(session.session_id, `goto ${app.baseUrl}/`);
    expect(first.console_errors).toContain('boom from fixture');
    expect(first.network_errors).toEqual([
      expect.stringContaining(`GET ${app.baseUrl}/dead`),
    ]);

    const second = await navigate(session.session_id, `goto ${app.baseUrl}/`);
    expect(second.console_errors).toEqual([]);
    expect(second.network_errors).toEqual([]);
    await end(session.session_id);
  });

  it('blocks navigation to another origin and never files it as an app issue', async () => {
    const session = await spawn();
    const requestsBefore = outsider.requests.length;

    const blocked = await navigate(
      session.session_id,
      `goto ${outsider.baseUrl}/welcome?token=secret`,
    );
    expect(blocked.success).toBe(false);
    expect(blocked.error?.startsWith(SANDBOX_BLOCK_PREFIX)).toBe(true);
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
    if (blocked.screenshot_path) {
      rmSync(`.haunt-reports/screenshots/${blocked.screenshot_path}`, {
        force: true,
      });
    }
  });

  it('enforces the step budget across the protocol', async () => {
    const session = await spawn({ timeout: 1 });
    const first = await navigate(session.session_id, `goto ${app.baseUrl}/`);
    expect(first.steps_remaining).toBe(0);

    const second = await haunt.call('haunt_navigate', {
      session_id: session.session_id,
      action: `goto ${app.baseUrl}/`,
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

    const [stateA, stateB] = await Promise.all(
      [a, b].map((s) =>
        haunt.call<CaptureOutput>('haunt_capture_state', {
          session_id: s.session_id,
          include_screenshot: false,
        }),
      ),
    );
    expect(stateA.data.title).toBe('Fixture Signup');
    expect(stateB.data.title).toBe('Fixture Welcome');

    await navigate(a.session_id, `goto ${app.baseUrl}/`);
    const [endedA, endedB] = await Promise.all([
      end(a.session_id),
      end(b.session_id),
    ]);
    expect(endedA.step_count).toBe(1);
    expect(endedB.step_count).toBe(0);
  });
});
