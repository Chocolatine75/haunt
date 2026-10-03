// mcp-server/src/gates/part-2/harness.ts
//
// What every part 2 gate test stands on: part 1's harness (a haunt session
// driven only through the MCP tools, and a line to the page behind them),
// opened on a signal page, with the signals of every call collected and
// compared with the gauntlet's ground truth.
//
// A result that carries no `signals` at all is an error here, never an empty
// list: a gate test must not pass because the feature is missing.
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import {
  type ExpectedSignal,
  type PageTruth,
  type Trigger,
  loadGroundTruth,
} from '../../test-support/gauntlet/ground-truth.js';
import type {
  GauntletPage,
  SignalPage,
  Variant,
} from '../../test-support/gauntlet/server.js';
import type { Action, StepResult } from '../part-1/contract.js';
import {
  type GateContext,
  type Session,
  useGauntlet,
} from '../part-1/harness.js';
import type {
  ActSignalsResult,
  CaptureSignalsInput,
  EndSessionSignalsOutput,
  Signal,
  SnapshotWithSignals,
} from './contract.js';
import { PASSING } from './status.js';

export const TRUTH = loadGroundTruth();

export const PERSONA = fileURLToPath(
  new URL(
    '../../engine/persona/__fixtures__/valid-persona.yaml',
    import.meta.url,
  ),
);

// Registers a gate test. `id` is its number in the spec's gate (S3.2),
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

function signalsIn(what: string, value: unknown): Signal[] {
  const signals = (value as { signals?: unknown } | undefined)?.signals;
  if (!Array.isArray(signals)) {
    throw new Error(`${what} returned no signals`);
  }
  return signals as Signal[];
}

export const pathOf = (url: string) => new URL(url).pathname;

// A haunt session and every signal it has handed over so far.
export class SignalSession {
  // Signals in the order they were delivered: by haunt_spawn, then by each
  // haunt_act. What haunt_end_session returns is kept apart, in `ended`.
  readonly delivered: Signal[] = [];
  // The result each signal came with: 0 for haunt_spawn, then 1, 2, … for
  // the calls to haunt_act, in order.
  readonly deliveredBy = new Map<string, number>();
  ended?: EndSessionSignalsOutput;
  private calls = 0;

  constructor(
    readonly s: Session,
    readonly atSpawn: Signal[],
  ) {
    this.keep(atSpawn);
  }

  private keep(signals: Signal[]): void {
    for (const signal of signals) {
      this.delivered.push(signal);
      this.deliveredBy.set(signal.id, this.calls);
    }
  }

  async act(...actions: Action[]): Promise<ActSignalsResult> {
    const result = await this.s.act(...actions);
    this.calls++;
    this.keep(signalsIn('haunt_act', result));
    return result as ActSignalsResult;
  }

  // The control carrying data-g="<g>", wherever it is.
  async click(g: string): Promise<ActSignalsResult> {
    return this.act({ type: 'click', ref: await this.s.ref(g) });
  }

  // Clicks a control of the ground truth and returns the step it was.
  async trigger(trigger: Pick<Trigger, 'trigger'>): Promise<number> {
    const result = await this.click(trigger.trigger);
    expect(result.results[0]?.ok, `${trigger.trigger} was not clicked`).toBe(
      true,
    );
    return result.step;
  }

  async wait(ms: number): Promise<ActSignalsResult> {
    return this.act({ type: 'wait_for', ms });
  }

  async capture(
    options: Omit<CaptureSignalsInput, 'session_id'>,
  ): Promise<Signal[]> {
    const snapshot = (await this.s.capture(options)) as SnapshotWithSignals;
    return signalsIn('haunt_capture_state', snapshot);
  }

  async end(): Promise<Signal[]> {
    const result = (await this.s.end()) as unknown as EndSessionSignalsOutput;
    this.ended = result;
    return signalsIn('haunt_end_session', result);
  }

  // Every signal of the session, once each: what was delivered along the
  // way and, when the session has ended, what the end added.
  all(): Signal[] {
    const byId = new Map<string, Signal>();
    for (const signal of [...this.delivered, ...(this.ended?.signals ?? [])]) {
      byId.set(signal.id, signal);
    }
    return [...byId.values()];
  }
}

export interface SignalContext extends GateContext {
  // Opens a session on a signal page. `spawn` is passed to haunt_spawn.
  sig(
    page: SignalPage,
    variant?: Variant,
    spawn?: Record<string, unknown>,
  ): Promise<SignalSession>;
  // The same on one of part 1's pages.
  part1(page: GauntletPage, query?: string): Promise<SignalSession>;
}

// Call once at the top of a gate file's describe block.
export function useSignals(): SignalContext {
  const context = useGauntlet() as SignalContext;
  // haunt_spawn's result is the last thing the server said.
  const wrap = (s: Session) => {
    const spawned = JSON.parse(
      context.transcript[context.transcript.length - 1],
    );
    return new SignalSession(s, signalsIn('haunt_spawn', spawned));
  };
  context.sig = async (page, variant = 'buggy', spawn = {}) =>
    wrap(
      await context.openUrl(
        context.gauntlet.url(page, `variant=${variant}`),
        spawn,
      ),
    );
  context.part1 = async (page, query) => wrap(await context.open(page, query));
  return context;
}

// ---------------------------------------------------------------------------
// Comparing with the ground truth
// ---------------------------------------------------------------------------

// Whether a signal is the one the ground truth describes. Steps and element
// references are compared by the tests that are about them.
export function fits(signal: Signal, expected: ExpectedSignal): boolean {
  const { contains, starts_with, at_least } = expected;
  const { path, source_path, count, ...exact } = expected.signal;
  const have = signal as unknown as Record<string, unknown>;

  for (const [field, value] of Object.entries(exact)) {
    if (have[field] !== value) return false;
  }
  if (signal.count !== ((count as number | undefined) ?? 1)) return false;

  const requestUrl = have.request_url as string | undefined;
  if (path !== undefined && (!requestUrl || pathOf(requestUrl) !== path)) {
    return false;
  }
  if (starts_with) {
    if (!requestUrl || !pathOf(requestUrl).startsWith(starts_with.path)) {
      return false;
    }
  }
  if (source_path !== undefined) {
    const source = have.source as { url?: string } | undefined;
    if (!source?.url || pathOf(source.url) !== source_path) return false;
  }
  if (contains && !signal.message.includes(contains.message)) return false;
  if (at_least) {
    const duration = have.duration_ms;
    if (typeof duration !== 'number' || duration < at_least.duration_ms) {
      return false;
    }
  }
  return true;
}

// Pairs each expected signal with a distinct signal that fits it. Returns
// what could not be paired on either side.
export function compare(
  signals: Signal[],
  expected: ExpectedSignal[],
): { missing: ExpectedSignal[]; extra: Signal[] } {
  const extra = [...signals];
  const missing: ExpectedSignal[] = [];
  for (const one of expected) {
    const at = extra.findIndex((signal) => fits(signal, one));
    if (at === -1) missing.push(one);
    else extra.splice(at, 1);
  }
  return { missing, extra };
}

// Fails unless `signals` is exactly what the ground truth lists.
export function expectExactly(
  signals: Signal[],
  expected: ExpectedSignal[],
  label: string,
): void {
  const { missing, extra } = compare(signals, expected);
  expect({ missing, extra }, label).toEqual({ missing: [], extra: [] });
}

// The shape every signal must have, whatever its kind (R-S1, R-S18).
export function expectWellFormed(signal: Signal): void {
  expect(signal.id, 'id').toMatch(/^s\d+$/);
  expect(Number.isInteger(signal.step) && signal.step >= 0, 'step').toBe(true);
  expect(signal.message.length, 'message').toBeGreaterThan(0);
  expect(['major', 'minor'], 'severity').toContain(signal.severity);
  expect(signal.count, 'count').toBeGreaterThanOrEqual(1);
  expect(signal.url, 'url').toMatch(/^https?:\/\/[^?#]+$/);
}

// ---------------------------------------------------------------------------
// A tour: every control of a page's ground truth, in one session
// ---------------------------------------------------------------------------

export interface Tour {
  page: SignalPage;
  truth: PageTruth;
  session: SignalSession;
  // The step each control was clicked at.
  steps: Map<string, number>;
  // Steps at which the page was opened again after a control left it.
  reloads: number[];
  // What the page really did, read from the page before the session ended.
  results: Map<string, StepResult>;
  // Every signal of the session, haunt_end_session's included.
  signals: Signal[];
}

// Clicks every control the ground truth lists, waits out the slowest
// defect, and ends the session.
export async function tour(
  ctx: SignalContext,
  page: SignalPage,
  variant: Variant,
  spawn?: Record<string, unknown>,
): Promise<Tour> {
  const truth = TRUTH[page];
  const session = await ctx.sig(page, variant, spawn);
  const steps = new Map<string, number>();
  const results = new Map<string, StepResult>();
  const reloads: number[] = [];
  const url = ctx.gauntlet.url(page, `variant=${variant}`);

  if (truth.secret_field) {
    // Typed first, so that it is not one of the numbered clicks.
    await session.act({
      type: 'fill',
      ref: await session.s.ref(truth.secret_field),
      text: TOUR_SECRET,
    });
  }
  // When the slowest defect clicked so far will have shown.
  let shown = 0;
  for (const [i, trigger] of truth.triggers.entries()) {
    const result = await session.click(trigger.trigger);
    expect(result.results[0]?.ok, `${trigger.trigger} was not clicked`).toBe(
      true,
    );
    steps.set(trigger.trigger, result.step);
    results.set(trigger.trigger, result.results[0]);
    const hung = trigger.signals.some((s) => s.signal.kind === 'request_hung');
    const lasts =
      hung && variant === 'buggy' ? HUNG_WAIT_MS : (trigger.wait_ms ?? 0);
    shown = Math.max(shown, Date.now() + lasts);
    // Back to the page for the controls that remain. Never after the last
    // one, so that a page with load defects does not load twice.
    if (trigger.navigates && i < truth.triggers.length - 1) {
      const back = await session.act({ type: 'goto', url });
      reloads.push(back.step);
    }
  }
  if (shown > Date.now()) await session.wait(shown - Date.now() + 300);
  const signals = await session.end().then(() => session.all());
  return { page, truth, session, steps, reloads, results, signals };
}

// With a space and a plus sign, so that it is not spelled the same in a URL
// as in the field: a redaction that only knows the typed form misses it.
export const TOUR_SECRET = 'Zq9 hunter2+xK';

// A request is hung once it has gone unanswered for the default threshold.
const HUNG_WAIT_MS = 10_000;

// What the ground truth expects of a whole tour of the buggy variant.
export function expectedOfTour(truth: PageTruth): ExpectedSignal[] {
  return [...truth.load, ...truth.triggers.flatMap((t) => t.signals)];
}

// Pages whose buggy variant is toured: all but the one with nothing to click.
export const TOURED = (Object.keys(TRUTH) as SignalPage[]).filter(
  (page) => TRUTH[page].triggers.length > 0,
);

// One tour per page and variant for a whole test file: several tests read
// the same tour, and the slowest takes a quarter of a minute.
export function useTours(ctx: SignalContext) {
  const tours = new Map<string, Promise<Tour>>();
  return (page: SignalPage, variant: Variant = 'buggy'): Promise<Tour> => {
    const key = `${page} ${variant}`;
    let found = tours.get(key);
    if (!found) {
      found = tour(ctx, page, variant);
      // Reported by the test that awaits it.
      found.catch(() => {});
      tours.set(key, found);
    }
    return found;
  };
}
