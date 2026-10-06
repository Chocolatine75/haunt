// mcp-server/src/gates/part-1/harness.ts
//
// What every part 1 gate test stands on: a haunt session opened on a gauntlet
// page and driven only through the MCP tools, plus a separate line to the
// page itself (through Playwright, behind the tools' back) to check what
// really happened. A gate test asserts on that second line. A tool that says
// "ok" while the page did nothing must fail.
import { fileURLToPath } from 'node:url';
import type { Frame, Page } from 'playwright';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { currentSabotage } from '../../engine/sabotage.js';
import { SessionManager } from '../../engine/session/manager.js';
import {
  type Gauntlet,
  type GauntletPage,
  startGauntlet,
} from '../../test-support/gauntlet/server.js';
import {
  type HauntClient,
  connectInMemory,
} from '../../test-support/mcp-client.js';
import type { Signal } from '../part-2/contract.js';
import { unplanted } from '../part-2/planted.js';
import type {
  ActResult,
  Action,
  ActionError,
  CaptureInput,
  Snapshot,
  SnapshotElement,
  StepResult,
} from './contract.js';
import { PASSING } from './status.js';

export interface GauntletEvent {
  type: string;
  id: string;
  // biome-ignore lint/suspicious/noExplicitAny: free-form per page
  detail: any;
  t: number;
}

const PERSONA = fileURLToPath(
  new URL(
    '../../engine/persona/__fixtures__/valid-persona.yaml',
    import.meta.url,
  ),
);

// Registers a gate test. `id` is its number in the spec's gate (G2.3),
// `requirements` the requirement ids it proves. Until the id is listed in
// status.ts the test is an expected failure.
export function gate(
  id: string,
  requirements: string,
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 30_000,
): void {
  const run = PASSING.has(id) ? it : it.fails;
  run(`${id} [${requirements}] ${name}`, fn, timeoutMs);
}

// Signals some part 1 tests cause on purpose: by reaching into the page
// behind the tools' back, or by asking for a response as slow as R-S4's
// threshold. What the page does is not in question there.
const CAUSED_BY_TEST: Record<string, string[]> = {
  'console errors and failed requests are delivered with the action that caused them':
    ['console_error', 'request_failed'],
  // Six chunks 500 ms apart: three seconds, the slow-response threshold.
  'a three-second streamed response is waited for': ['slow_response'],
};

// Sessions opened while the engine was deliberately broken (G7.1): what they
// raise says nothing about the pages.
const sabotagedSessions = new Set<string>();

// Part 2 (S2.3): the part 1 gate, run with signals collected, raises none
// on a page that plants none. Checked on every session a gate test opens on
// one of part 1's pages, when it ends or when the test does. Does nothing
// while the engine collects no signals.
function expectNoneUnplanted(signals: Signal[] | undefined): void {
  const test = expect.getState().currentTestName ?? '';
  const caused = Object.entries(CAUSED_BY_TEST).find(([name]) =>
    test.endsWith(name),
  )?.[1];
  const onPart1 = (signals ?? []).filter(
    (signal) =>
      // Part 2's, part 3's and part 5's pages plant their signals on
      // purpose.
      !/^\/(sig|ev|lay)[-/]/.test(new URL(signal.url).pathname) &&
      // And part 1's own page of overlays plants what part 5 reports as a
      // layout defect: a banner that covers a button for good.
      !(
        (signal.kind as string) === 'layout' &&
        new URL(signal.url).pathname === '/overlays'
      ) &&
      !caused?.includes(signal.kind),
  );
  expect(unplanted(onPart1), 'signals a part 1 page did not plant').toEqual([]);
}

export class Session {
  constructor(
    private readonly haunt: HauntClient,
    private readonly manager: SessionManager,
    readonly id: string,
    readonly gauntlet: Gauntlet,
  ) {}

  // ----- through the tools -------------------------------------------------

  async capture(
    options: Omit<CaptureInput, 'session_id'> = {},
  ): Promise<Snapshot> {
    const result = await this.haunt.call<Snapshot>('haunt_capture_state', {
      session_id: this.id,
      ...options,
    });
    if (result.isError) throw new Error(result.text);
    return result.data;
  }

  // The full snapshot as data, with each element's gauntlet id attached.
  async snapshot(
    options: Omit<CaptureInput, 'session_id' | 'format'> = {},
  ): Promise<Snapshot & { elements: SnapshotElement[] }> {
    const snapshot = await this.capture({
      format: 'json',
      include_attributes: ['data-g'],
      ...options,
    });
    if (!Array.isArray(snapshot.elements)) {
      throw new Error(
        'haunt_capture_state returned no elements for format: json',
      );
    }
    return snapshot as Snapshot & { elements: SnapshotElement[] };
  }

  // The element carrying data-g="<g>", as the snapshot reports it.
  async element(g: string): Promise<SnapshotElement> {
    const { elements } = await this.snapshot();
    const found = elements.filter((e) => e.attributes?.['data-g'] === g);
    if (found.length !== 1) {
      throw new Error(
        `expected one snapshot element for data-g="${g}", found ${found.length}`,
      );
    }
    return found[0];
  }

  async ref(g: string): Promise<string> {
    return (await this.element(g)).ref;
  }

  // The way a tester finds things: by role and accessible name.
  async named(role: string, name: string): Promise<SnapshotElement[]> {
    const { elements } = await this.snapshot();
    return elements.filter((e) => e.role === role && e.name === name);
  }

  // Wall-clock time of the most recent haunt_act call, as a caller sees it.
  lastActMs = 0;

  async act(...actions: Action[]): Promise<ActResult> {
    const start = performance.now();
    const result = await this.haunt.call<ActResult>('haunt_act', {
      session_id: this.id,
      actions,
    });
    this.lastActMs = performance.now() - start;
    if (result.isError) throw new Error(result.text);
    return result.data;
  }

  // Runs actions that must all succeed and returns the last step.
  async ok(...actions: Action[]): Promise<StepResult> {
    const result = await this.act(...actions);
    const failed = result.results.find((r) => !r.ok);
    expect(failed?.error, 'an action failed').toBeUndefined();
    expect(result.executed).toBe(actions.length);
    return result.results[result.results.length - 1];
  }

  // Runs one action that must fail and returns its error.
  async fail(action: Action): Promise<ActionError> {
    const result = await this.act(action);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].ok).toBe(false);
    expect(result.stopped).toBe('failed');
    const error = result.results[0].error;
    if (!error) throw new Error('failed action carried no error');
    return error;
  }

  async end(): Promise<{
    issues_found: unknown[];
    sandbox_blocked_requests: string[];
  }> {
    const result = await this.haunt.call<{
      issues_found: unknown[];
      sandbox_blocked_requests: string[];
    }>('haunt_end_session', { session_id: this.id });
    if (result.isError) throw new Error(result.text);
    if (!sabotagedSessions.has(this.id)) {
      expectNoneUnplanted((result.data as { signals?: Signal[] }).signals);
    }
    return result.data;
  }

  // ----- behind the tools --------------------------------------------------

  private get engineSession() {
    const session = this.manager.all().find((s) => s.id === this.id);
    if (!session) throw new Error(`session ${this.id} is gone`);
    return session;
  }

  // The tab the session started on.
  get page(): Page {
    return this.engineSession.page;
  }

  get pages(): Page[] {
    return this.engineSession.page.context().pages();
  }

  // Issues the server filed on its own (R-D4 says there must be none).
  get filedIssues(): unknown[] {
    return this.engineSession.issues;
  }

  get stepCount(): number {
    return this.engineSession.step_count;
  }

  async frame(name: string): Promise<Frame> {
    for (const frame of this.page.frames()) {
      const found = await frame
        .evaluate(() => window.__gauntlet?.state.name)
        .catch(() => undefined);
      if (found === name) return frame;
    }
    throw new Error(`no gauntlet frame named ${name}`);
  }

  events(
    type?: string,
    where: Page | Frame = this.page,
  ): Promise<GauntletEvent[]> {
    return where.evaluate(
      (t) =>
        window.__gauntlet.events.filter(
          (e: GauntletEvent) => !t || e.type === t,
        ),
      type,
    );
  }

  // Real clicks received, as "<data-g>" in order.
  async clicks(where: Page | Frame = this.page): Promise<string[]> {
    return (await this.events('click', where)).map((e) => e.id);
  }

  // biome-ignore lint/suspicious/noExplicitAny: free-form per page
  state(where: Page | Frame = this.page): Promise<any> {
    return where.evaluate(() => window.__gauntlet.state);
  }

  // Every data-g the page itself knows about in this document.
  registry(where: Page | Frame = this.page): Promise<string[]> {
    return where.evaluate(() => window.__gauntlet.ids());
  }

  // Reads a property of an element straight from the DOM.
  dom<T>(g: string, read: string, where: Page | Frame = this.page): Promise<T> {
    return where.evaluate(
      ([id, body]) => {
        const el = window.__gauntlet.find(id);
        return new Function('el', `return (${body});`)(el);
      },
      [g, read],
    ) as Promise<T>;
  }

  status(): Promise<string | null> {
    return this.page.locator('#result').textContent();
  }
}

export interface GateContext {
  gauntlet: Gauntlet;
  // Every piece of text the server has returned in this file's tests.
  transcript: string[];
  // Opens a haunt session on a gauntlet page.
  open(
    page: GauntletPage,
    query?: string,
    spawn?: Record<string, unknown>,
  ): Promise<Session>;
  openUrl(url: string, spawn?: Record<string, unknown>): Promise<Session>;
  haunt: HauntClient;
  // Closes the open sessions without looking at what they produced: for a
  // test that broke the engine on purpose.
  discard(): Promise<void>;
}

// Call once at the top of a gate file's describe block.
export function useGauntlet(): GateContext {
  const context = {} as GateContext;
  const manager = new SessionManager();
  let contractChecked: Promise<void> | undefined;

  beforeAll(async () => {
    context.gauntlet = await startGauntlet();
    context.haunt = await connectInMemory(manager);
    const call = context.haunt.call.bind(context.haunt);
    context.transcript = [];
    context.haunt.call = (async (
      name: string,
      args?: Record<string, unknown>,
    ) => {
      const result = await call(name, args);
      context.transcript.push(result.text);
      return result;
    }) as HauntClient['call'];
  });

  const closeAll = async (): Promise<Signal[]> => {
    const signals: Signal[] = [];
    for (const session of manager.all()) {
      if (!sabotagedSessions.has(session.id)) {
        signals.push(...((session as { signals?: Signal[] }).signals ?? []));
      }
      await session.browser.close().catch(() => {});
      manager.delete(session.id);
    }
    return signals;
  };
  context.discard = async () => {
    await closeAll();
  };

  afterEach(async () => {
    expectNoneUnplanted(await closeAll());
  });

  afterAll(async () => {
    await context.haunt?.close();
    await context.gauntlet?.close();
  });

  // Fails at once, before launching a browser, while the tools do not exist.
  const requireContract = () => {
    contractChecked ??= context.haunt.client.listTools().then(({ tools }) => {
      const capture = tools.find((t) => t.name === 'haunt_capture_state');
      if (!JSON.stringify(capture?.inputSchema ?? {}).includes('"format"')) {
        throw new Error('the reference snapshot is not implemented');
      }
    });
    return contractChecked;
  };

  context.openUrl = async (url, spawn = {}) => {
    await requireContract();
    const result = await context.haunt.call<{ session_id: string }>(
      'haunt_spawn',
      {
        persona: PERSONA,
        target_url: url,
        timeout: 5_000,
        // Part 3 replays every issue and signal when a session ends: not
        // what the earlier gates are about, and minutes per session.
        replay_budget_ms: 0,
        ...spawn,
      },
    );
    if (result.isError) throw new Error(result.text);
    if (currentSabotage()) sabotagedSessions.add(result.data.session_id);
    return new Session(
      context.haunt,
      manager,
      result.data.session_id,
      context.gauntlet,
    );
  };
  context.open = (page, query, spawn) =>
    context.openUrl(context.gauntlet.url(page, query), spawn);

  return context;
}

// Worst of n runs, in milliseconds.
export async function worstOf(
  n: number,
  run: () => Promise<unknown>,
): Promise<number> {
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    await run();
    worst = Math.max(worst, performance.now() - start);
  }
  return worst;
}
