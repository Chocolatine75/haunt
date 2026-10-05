// What lets several agents share a run without each result crossing a
// model's context twice: a tester takes its cases from the planner's
// session by id, even once that session has ended, and the report is handed
// session ids rather than their results.
import { readFileSync, rmSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type {
  EndSessionTesterOutput,
  PlanOutput,
  ReportTesterSidecar,
} from '../../gates/part-4/contract.js';
import {
  type Gauntlet,
  startGauntlet,
} from '../../test-support/gauntlet/server.js';
import {
  type HauntClient,
  connectInMemory,
} from '../../test-support/mcp-client.js';
import { SessionManager } from '../session/manager.js';

describe('a plan handed from a planner to testers', { timeout: 60_000 }, () => {
  let gauntlet: Gauntlet;
  let haunt: HauntClient;
  const manager = new SessionManager();
  const written: string[] = [];

  beforeAll(async () => {
    gauntlet = await startGauntlet();
    haunt = await connectInMemory(manager);
  });
  afterEach(async () => {
    for (const session of manager.all()) await session.browser.close();
  });
  afterAll(async () => {
    for (const path of written) rmSync(path, { force: true });
    await haunt.close();
    await gauntlet.close();
  });

  const url = () => gauntlet.url('qa-form', 'variant=buggy');
  async function spawn(): Promise<string> {
    const result = await haunt.call<{ session_id: string }>('haunt_spawn', {
      target_url: url(),
      replay_budget_ms: 0,
    });
    if (result.isError) throw new Error(result.text);
    return result.data.session_id;
  }
  async function plan(args: Record<string, unknown>): Promise<PlanOutput> {
    const result = await haunt.call<PlanOutput>('haunt_plan', args);
    if (result.isError) throw new Error(result.text);
    return result.data;
  }
  const ref = (p: PlanOutput, name: string) =>
    p.inventory.find((c) => c.name === name)?.ref ?? '';

  // A planner's session with two cases, ended.
  async function planned(): Promise<string> {
    const session_id = await spawn();
    const inventory = await plan({ session_id });
    await plan({
      session_id,
      cases: [
        {
          id: 'summary-kept',
          kind: 'state',
          controls: [
            ref(inventory, 'Email me a weekly summary'),
            ref(inventory, 'Save'),
          ],
          expect: 'The weekly summary stays checked once saved',
        },
        {
          id: 'negative-quantity',
          kind: 'edge',
          controls: [ref(inventory, 'Boxes per delivery')],
          expect: 'A negative number of boxes is refused',
        },
      ],
    });
    await haunt.call('haunt_end_session', { session_id });
    return session_id;
  }

  it('gives a tester the cases it names, from a session that has ended', async () => {
    const from = await planned();
    const session_id = await spawn();
    const taken = await plan({ session_id, from, only: ['summary-kept'] });
    expect(taken.cases.map((one) => one.id)).toEqual(['summary-kept']);
    expect(taken.cases[0].controls).toEqual([
      ref(taken, 'Email me a weekly summary'),
      ref(taken, 'Save'),
    ]);

    // All of them when none is named, beside one of the tester's own.
    const other = await spawn();
    const all = await plan({
      session_id: other,
      from,
      cases: [
        {
          id: 'mine',
          kind: 'normal',
          controls: [],
          expect: 'The page says what was saved',
        },
      ],
    });
    expect(all.cases.map((one) => one.id).sort()).toEqual([
      'mine',
      'negative-quantity',
      'summary-kept',
    ]);
  });

  it('says which session or case is missing, and takes none then', async () => {
    const from = await planned();
    const session_id = await spawn();
    const nowhere = await haunt.call('haunt_plan', {
      session_id,
      from: 'no-such-session',
    });
    expect(nowhere.isError).toBe(true);
    expect(nowhere.text).toContain('no-such-session');

    const missing = await haunt.call('haunt_plan', {
      session_id,
      from,
      only: ['summary-kept', 'made-up'],
    });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('"made-up"');
    expect(missing.text).toContain('"negative-quantity"');
    expect((await plan({ session_id })).cases).toEqual([]);
  });

  it('reports on sessions named by their id, with what each returned when it ended', async () => {
    const from = await planned();
    const session_id = await spawn();
    const taken = await plan({ session_id, from, only: ['summary-kept'] });
    await haunt.call('haunt_act', {
      session_id,
      actions: [
        {
          type: 'check',
          ref: ref(taken, 'Email me a weekly summary'),
          checked: true,
        },
        { type: 'click', ref: ref(taken, 'Save') },
      ],
      case: 'summary-kept',
      expect: {
        value: {
          ref: ref(taken, 'Email me a weekly summary'),
          of: 'checked',
          is: true,
        },
      },
    });
    const ended = await haunt.call<EndSessionTesterOutput>(
      'haunt_end_session',
      { session_id, overall_impression: 'The box is unchecked on save.' },
    );

    const report = await haunt.call<{ report_path: string; markdown: string }>(
      'haunt_generate_report',
      {
        target_url: url(),
        date: '2026-04-09',
        sessions: [{ session_id, area: '/qa-form' }],
      },
    );
    expect(report.isError, report.text).toBe(false);
    const sidecarPath = report.data.report_path.replace(/\.md$/, '.json');
    written.push(report.data.report_path, sidecarPath);
    const sidecar = JSON.parse(
      readFileSync(sidecarPath, 'utf-8'),
    ) as ReportTesterSidecar;
    expect(sidecar.coverage?.controls).toEqual(ended.data.coverage.controls);
    expect(sidecar.coverage?.cases).toMatchObject({ planned: 1, failed: 1 });
    // What the session said of itself, unless the caller says otherwise.
    expect(report.data.markdown).toContain('The box is unchecked on save.');
    expect(report.data.markdown).toContain('**/qa-form:**');

    const unknown = await haunt.call('haunt_generate_report', {
      target_url: url(),
      sessions: [{ session_id: 'never-ended', area: '/' }],
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('never-ended');
  });
});
