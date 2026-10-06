// mcp-server/src/engine/signals/collector.ts
//
// Deterministic signals: what a page did wrong that can be established
// without asking a model. Specified in docs/v3/part-2-signals.md; the shape
// of a signal is fixed by gates/part-2/contract.ts.
//
// One collector per session. It hears of things from two sides: the
// browser's network events, and the hooks installed in every document
// (snapshot/page-script.ts), which report exceptions, rejections,
// console.error calls and long tasks through a binding. Each is attributed
// to the step that caused it, counted once, and handed over once.
import type { BrowserContext, Frame, Page, Request } from 'playwright';
import type { Signal, SignalThresholds } from '../../gates/part-2/contract.js';
import { sabotaged } from '../sabotage.js';
import type { LayoutFinding } from './layout.js';

export const DEFAULT_THRESHOLDS: SignalThresholds = {
  slow_response_ms: 3_000,
  long_task_ms: 500,
  hung_request_ms: 10_000,
};

// The name the page hooks call (snapshot/page-script.ts repeats it: a
// function that runs in the page cannot import).
export const REPORT_BINDING = '__hauntReport';

const REDACTED = '[redacted]';
// A typed value shorter than this would be found in half the messages.
const MIN_SECRET_LENGTH = 4;
// A cookie that holds "dark" or "1" is no one's secret, and rewriting every
// "1" would garble a trace; a session token is longer than this.
const MIN_TOKEN_LENGTH = 8;
const MAX_MESSAGE = 500;
const MAX_STACK = 4_000;
// A page can call the binding as often as it likes.
const MAX_SIGNALS = 500;

// Responses whose slowness a user waits on: the page and its data.
const DATA_TYPES = new Set(['document', 'fetch', 'xhr']);

// What the collector needs to know about the sandbox (engine/spawn.ts).
export interface SandboxView {
  // The request was refused by the sandbox, whatever else is true of it.
  blocked(request: Request): boolean;
  // The origin is one the app itself talks to.
  allowed(origin: string): boolean;
  // How many requests the sandbox has refused so far.
  blockedCount(): number;
}

export interface CollectorOptions {
  thresholds?: Partial<SignalThresholds>;
  // The session was given cookies: a 401 is then not simply "not logged in".
  authenticated: boolean;
  sandbox: SandboxView;
}

// What a page hook sends. Untrusted: the page can call the binding itself.
interface PageReport {
  k: 'error' | 'rejection' | 'console' | 'longtask';
  // The document it comes from and its number there, so that one report
  // can refer to an earlier one.
  d?: string;
  n?: number;
  message?: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  duration?: number;
  // When it happened, and when what caused it was started, in epoch ms.
  at?: number;
  cause?: number;
  // The report of this document that says the same thing.
  supersedes?: number;
}

interface Pending {
  at: number;
  step: number;
  frame: Frame | null;
  page: string;
  // Reported as hung: whatever becomes of it is the same fact.
  hung?: boolean;
  // A navigation the tester asked for (goto, back, reload…).
  typed?: boolean;
  // Has its response; the body may still be coming (a stream).
  answered?: boolean;
}

// What the collector keeps about a signal that is not part of it.
interface Meta {
  key: string;
  delivered: boolean;
  // The document and number of the page report it came from.
  report?: string;
}

// Omit, kind by kind: on the union itself it would keep only what every kind
// has.
type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Draft = Without<Signal, 'id' | 'count' | 'late'>;

export function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

// Query strings and fragments out of every URL in a text. In a stack a URL
// is followed by its line and column, which stay.
export function scrubUrls(text: string): string {
  return text.replace(/\bhttps?:\/\/[^\s)'"<>]+/g, (found) => {
    const position = /(:\d+){1,2}$/.exec(found)?.[0] ?? '';
    const url = position ? found.slice(0, -position.length) : found;
    return withoutQuery(url) + position;
  });
}

// The ways a typed value can be spelled once a page has put it in a URL.
function spellings(secret: string): string[] {
  const forms = new Set([
    secret,
    encodeURIComponent(secret),
    encodeURI(secret),
    secret.replaceAll(' ', '+'),
    encodeURIComponent(secret).replaceAll('%20', '+'),
  ]);
  // Longest first, so that one spelling is not cut by a shorter one.
  return [...forms].sort((a, b) => b.length - a.length);
}

const clip = (text: unknown, max: number): string =>
  (typeof text === 'string' ? text : '').slice(0, max);

const seconds = (ms: number) => `${(ms / 1_000).toFixed(1)} s`;

export class SignalCollector {
  // Every signal of the session, as raised: what was typed into credential
  // fields is removed when they are handed over, not here.
  readonly signals: Signal[] = [];
  readonly thresholds: SignalThresholds;

  private readonly meta = new Map<string, Meta>();
  private readonly byKey = new Map<string, Signal>();
  private readonly inflight = new Map<Request, Pending>();
  private readonly layoutSeen = new Set<string>();
  private readonly secrets: string[] = [];
  // Of those, what was typed into a password field.
  private readonly passwords: string[] = [];
  // 401s and 403s that answered a request carrying one of them while the
  // session was logged out: expected if the page then says so (R-S14).
  private readonly refusals = new WeakSet<Signal>();
  // Steps that left the page's text exactly as it was.
  private readonly sameText = new Set<number>();
  // When each step started; index 0 is the session's own start.
  private readonly stepStarts: number[] = [Date.now()];
  private readonly feedback = new Map<number, boolean>();
  private readonly requestsIn = new Map<number, number>();
  private readonly blocksAt = new Map<number, number>();
  // Navigations the tester asked for that are under way.
  private typing = 0;
  private next = 1;

  constructor(private readonly options: CollectorOptions) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  }

  private get off(): boolean {
    return sabotaged('signals_off');
  }

  // ----- the browser's side ------------------------------------------------

  attach(context: BrowserContext): void {
    context.on('request', (request) => this.onRequest(request));
    context.on('response', (response) => {
      const request = response.request();
      this.onResponse(request, response.status(), response.headers());
    });
    context.on('requestfinished', (request) => this.inflight.delete(request));
    context.on('requestfailed', (request) => this.onFailed(request));
    context.on('console', (message) => {
      // Sabotage only: the browser's own line about a failed request is the
      // same fact as the request's signal (R-S13) and is otherwise ignored.
      if (
        sabotaged('signals_console_line') &&
        message.type() === 'error' &&
        message.text().startsWith('Failed to load resource')
      ) {
        this.raise({
          kind: 'console_error',
          url: withoutQuery(message.page()?.url() ?? ''),
          step: this.currentStep,
          message: message.text(),
          severity: 'minor',
        });
      }
    });
  }

  private onRequest(request: Request): void {
    if (this.off) return;
    let frame: Frame | null = null;
    try {
      frame = request.frame();
    } catch {
      // A request no frame made (a service worker's).
    }
    const at = Date.now();
    const step = this.stepAt(at);
    this.inflight.set(request, {
      at,
      step,
      frame,
      page: pageUrl(frame, request),
      typed:
        this.typing > 0 &&
        request.isNavigationRequest() &&
        !frame?.parentFrame(),
    });
    this.requestsIn.set(step, (this.requestsIn.get(step) ?? 0) + 1);
  }

  private onResponse(
    request: Request,
    status: number,
    headers: Record<string, string>,
  ): void {
    const pending = this.inflight.get(request);
    if (!pending) return;
    pending.answered = true;
    const type = request.resourceType();
    const base = {
      url: pending.page,
      step: this.stepOf(pending.step),
      method: request.method(),
      request_url: withoutQuery(request.url()),
    };

    // A document that replaces the one in its frame cancels what that
    // document had asked for; the browser says nothing more about those
    // requests (R-S12). A download replaces nothing.
    const download = /attachment/i.test(headers['content-disposition'] ?? '');
    if (request.isNavigationRequest() && !download) {
      this.forgetRequestsOf(pending.frame, pending.at);
    }

    if (status >= 400 && !(status < 500 && sabotaged('signals_ignore_4xx'))) {
      const loggedOut =
        (status === 401 || status === 403) && !this.options.authenticated;
      const path = new URL(base.request_url).pathname;
      const signal = this.raise({
        ...base,
        kind: 'http_error',
        status,
        resource_type: type,
        message: `${base.method} ${path} answered ${status}`,
        severity: status >= 500 && DATA_TYPES.has(type) ? 'major' : 'minor',
        ...(loggedOut ? { while_logged_out: true as const } : {}),
      });
      if (signal && loggedOut && this.carriesPassword(request)) {
        this.refusals.add(signal);
        this.setFeedback(signal);
      }
    }

    if (DATA_TYPES.has(type) && !pending.hung) {
      // The browser's own measure when it has one; this process hears of
      // both ends late when it is busy.
      const measured = Math.max(
        Date.now() - pending.at,
        Math.round(request.timing().responseStart),
      );
      if (measured >= this.thresholds.slow_response_ms) {
        const path = new URL(base.request_url).pathname;
        this.raise({
          ...base,
          kind: 'slow_response',
          duration_ms: measured,
          message: `${base.method} ${path} took ${seconds(measured)} to answer`,
          severity: 'minor',
        });
      }
    }
  }

  private onFailed(request: Request): void {
    const pending = this.inflight.get(request);
    this.inflight.delete(request);
    if (!pending) return;

    const { sandbox } = this.options;
    let origin: string;
    try {
      origin = new URL(request.url()).origin;
    } catch {
      return;
    }
    // A sandbox block is not an app failure (R-S11).
    if (
      (sandbox.blocked(request) || !sandbox.allowed(origin)) &&
      !sabotaged('signals_sandbox_blocks')
    ) {
      return;
    }
    const error = request.failure()?.errorText ?? 'unknown';
    // Cancelled: by the page itself, by leaving it, or because it became a
    // download (R-S12). And a request already reported as hung is one fact.
    if (error === 'net::ERR_ABORTED' || pending.hung) return;
    // An address the tester typed that does not answer: the action fails
    // with navigation_failed, which says so. The app did nothing.
    if (pending.typed) return;

    const requestUrl = withoutQuery(request.url());
    this.raise({
      kind: 'request_failed',
      url: pending.page,
      step: this.stepOf(pending.step),
      method: request.method(),
      request_url: requestUrl,
      error,
      message: `${request.method()} ${new URL(requestUrl).pathname} failed: ${error}`,
      severity: 'minor',
    });
  }

  private forgetRequestsOf(frame: Frame | null, before: number): void {
    if (!frame) return;
    const inside = (candidate: Frame | null): boolean => {
      for (let f = candidate; f; f = f.parentFrame()) {
        if (f === frame) return true;
      }
      return false;
    };
    for (const [request, pending] of this.inflight) {
      if (pending.at >= before) continue;
      if (
        !pending.frame ||
        pending.frame.isDetached() ||
        inside(pending.frame)
      ) {
        this.inflight.delete(request);
      }
    }
  }

  // Requests that have gone unanswered for longer than the threshold.
  checkHung(now = Date.now()): void {
    for (const [request, pending] of this.inflight) {
      const waited = now - pending.at;
      if (pending.hung || pending.answered) continue;
      if (waited < this.thresholds.hung_request_ms) continue;
      if (pending.frame?.isDetached()) {
        this.inflight.delete(request);
        continue;
      }
      pending.hung = true;
      const requestUrl = withoutQuery(request.url());
      this.raise({
        kind: 'request_hung',
        url: pending.page,
        step: this.stepOf(pending.step),
        method: request.method(),
        request_url: requestUrl,
        duration_ms: waited,
        message: `${request.method()} ${new URL(requestUrl).pathname} has had no answer for ${seconds(waited)}`,
        severity: 'major',
      });
    }
  }

  // Requests the last step started that are still on the wire and might
  // still answer.
  awaited(): number {
    const since = this.lastStepStart;
    let count = 0;
    for (const pending of this.inflight.values()) {
      if (pending.at >= since && !pending.hung && !pending.answered) count++;
    }
    return count;
  }

  // Runs a navigation the tester asked for.
  async typed<T>(navigation: Promise<T>): Promise<T> {
    this.typing++;
    try {
      return await navigation;
    } finally {
      this.typing--;
    }
  }

  // ----- the page's side ---------------------------------------------------

  // Called through the binding by the hooks of any document of the session.
  fromPage(source: { page: Page; frame: Frame }, raw: unknown): void {
    if (this.off) return;
    let report: PageReport;
    try {
      report = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!report || typeof report !== 'object') return;

    const at = typeof report.at === 'number' ? report.at : Date.now();
    const cause = typeof report.cause === 'number' ? report.cause : at;
    const base = {
      url: withoutQuery(source.page.url()),
      step: this.stepOf(this.stepAt(Math.min(cause, at))),
    };
    const frameUrl = withoutQuery(source.frame.url());
    const document = `${clip(report.d, 40)}#${Number(report.n)}`;
    const superseded =
      typeof report.supersedes === 'number'
        ? `${clip(report.d, 40)}#${report.supersedes}`
        : undefined;
    const message = clip(report.message, MAX_MESSAGE) || '(no message)';

    switch (report.k) {
      case 'error': {
        const line = Number(report.line) || 1;
        const column = Number(report.column) || 1;
        const url = withoutQuery(clip(report.url, 2_000)) || frameUrl;
        this.dropReport(superseded);
        this.raise(
          {
            ...base,
            kind: 'js_exception',
            message: message.replace(/^Uncaught /, ''),
            stack:
              clip(report.stack, MAX_STACK) ||
              `${message}\n    at ${url}:${line}:${column}`,
            source: { url, line, column },
            severity: 'major',
          },
          document,
        );
        break;
      }
      case 'rejection': {
        // The sandbox refused a request and the page did not catch the
        // failure: that follows only from the block (R-S11).
        const blockedNow =
          this.options.sandbox.blockedCount() >
          (this.blocksAt.get(base.step) ?? 0);
        if (
          blockedNow &&
          /failed to fetch|load failed|networkerror/i.test(message)
        ) {
          break;
        }
        this.dropReport(superseded);
        this.raise(
          {
            ...base,
            kind: 'unhandled_rejection',
            message,
            stack: clip(report.stack, MAX_STACK) || message,
            severity: 'major',
          },
          document,
        );
        break;
      }
      case 'console':
        this.raise(
          { ...base, kind: 'console_error', message, severity: 'minor' },
          document,
        );
        break;
      case 'longtask': {
        const duration = Math.round(Number(report.duration) || 0);
        if (duration < this.thresholds.long_task_ms) break;
        this.raise({
          ...base,
          kind: 'long_task',
          duration_ms: duration,
          message: `The page did not respond for ${duration} ms`,
          severity: 'minor',
        });
        break;
      }
    }
  }

  // A console.error that turned out to be the first trace of an exception
  // or a rejection (R-S13). Only while nobody has been told of it.
  private dropReport(report: string | undefined): void {
    if (!report || sabotaged('signals_no_dedup')) return;
    const index = this.signals.findIndex((signal) => {
      const meta = this.meta.get(signal.id);
      return meta?.report === report && !meta.delivered;
    });
    if (index === -1) return;
    const [dropped] = this.signals.splice(index, 1);
    const meta = this.meta.get(dropped.id);
    if (meta) this.byKey.delete(meta.key);
    this.meta.delete(dropped.id);
  }

  // ----- steps -------------------------------------------------------------

  get currentStep(): number {
    return this.stepStarts.length - 1;
  }

  get lastStepStart(): number {
    return this.stepStarts[this.stepStarts.length - 1];
  }

  startStep(step: number): void {
    this.stepStarts[step] = Date.now();
    this.blocksAt.set(step, this.options.sandbox.blockedCount());
  }

  // Whether any text appeared on the page during the step (R-S5), and
  // whether its text is exactly what it was before.
  endStep(step: number, feedback: boolean, sameText = false): void {
    this.feedback.set(step, feedback);
    if (sameText) this.sameText.add(step);
    for (const signal of this.signals) {
      if (signal.step === step) this.setFeedback(signal);
    }
  }

  // The step that was running, or had last run, at a moment.
  private stepAt(time: number): number {
    for (let step = this.stepStarts.length - 1; step > 0; step--) {
      if (time >= this.stepStarts[step]) return step;
    }
    return 0;
  }

  private stepOf(caused: number): number {
    return sabotaged('signals_latest_step') ? this.currentStep : caused;
  }

  // What a step set in motion, as far as can be told from here: requests it
  // started and signals attributed to it.
  causedAnything(step: number): boolean {
    return (
      (this.requestsIn.get(step) ?? 0) > 0 ||
      this.signals.some((signal) => signal.step === step)
    );
  }

  // ----- raising and handing over -------------------------------------------

  private setFeedback(signal: Signal): void {
    if (signal.step === 0) return;
    if (
      signal.kind !== 'http_error' &&
      signal.kind !== 'request_failed' &&
      signal.kind !== 'js_exception'
    ) {
      return;
    }
    const feedback = this.feedback.get(signal.step);
    if (feedback !== undefined) signal.feedback = feedback;
    if (
      signal.kind === 'http_error' &&
      this.refusals.has(signal) &&
      (feedback === true ||
        (this.sameText.has(signal.step) && this.explainedBefore(signal)))
    ) {
      signal.expected = true;
    }
  }

  // The request was sent with a password typed in this session in its body.
  private carriesPassword(request: Request): boolean {
    const body = request.postData() ?? '';
    if (!body) return false;
    return this.passwords.some((password) =>
      [...spellings(password), JSON.stringify(password).slice(1, -1)].some(
        (form) => body.includes(form),
      ),
    );
  }

  // The same refusal on the same page, explained then, with the page's text
  // unchanged since: a second wrong password under the message of the first
  // adds no text, and is no less explained.
  private explainedBefore(signal: Signal): boolean {
    if (signal.kind !== 'http_error') return false;
    for (let step = signal.step - 1; step > 0; step--) {
      const earlier = this.signals.find(
        (s) =>
          s.step === step &&
          s.kind === 'http_error' &&
          s.url === signal.url &&
          s.method === signal.method &&
          s.request_url === signal.request_url &&
          s.status === signal.status,
      );
      if (earlier) return earlier.kind === 'http_error' && !!earlier.expected;
      if (!this.sameText.has(step)) return false;
    }
    return false;
  }

  raise(draft: Draft, report?: string): Signal | undefined {
    if (this.off || !/^https?:/.test(draft.url)) return undefined;
    const {
      message: _m,
      severity: _s,
      ...identity
    } = draft as Draft & {
      duration_ms?: number;
    };
    // How long it lasted is not what it is.
    identity.duration_ms = undefined;
    const key = JSON.stringify([draft.message, identity]);

    const known = this.byKey.get(key);
    if (known && !sabotaged('signals_no_dedup')) {
      known.count++;
      return known;
    }
    if (this.signals.length >= MAX_SIGNALS) return undefined;

    const signal = { ...draft, id: `s${this.next++}`, count: 1 } as Signal;
    this.setFeedback(signal);
    this.signals.push(signal);
    this.byKey.set(key, signal);
    this.meta.set(signal.id, { key, delivered: false, report });
    return signal;
  }

  raiseDeadControl(
    step: number,
    url: string,
    control: { ref: string; role: string; name: string },
  ): void {
    this.raise({
      kind: 'dead_control',
      url: withoutQuery(url),
      step,
      ...control,
      message: `Clicking the ${control.role} "${control.name}" changed nothing`,
      severity: 'major',
    });
  }

  // What an accessibility audit of the page at `url` found (R-S15, R-S16).
  // A violation the session already knows on that page, the same elements
  // included, is that signal again, not a new one.
  fromAudit(
    url: string,
    step: number,
    violations: Array<{
      rule: string;
      impact: 'minor' | 'moderate' | 'serious' | 'critical';
      help: string;
      nodes: number;
      refs: string[];
      sample?: { checked: number; of: number };
    }>,
    options: { again?: boolean } = {},
  ): Signal[] {
    const page = withoutQuery(url);
    const out: Signal[] = [];
    for (const v of violations) {
      const known = options.again
        ? undefined
        : this.signals.find(
            (signal) =>
              signal.kind === 'a11y' &&
              signal.url === page &&
              signal.rule === v.rule &&
              signal.nodes === v.nodes &&
              signal.refs.join() === v.refs.join(),
          );
      const signal =
        known ??
        this.raise({
          kind: 'a11y',
          url: page,
          step,
          rule: v.rule,
          impact: v.impact,
          nodes: v.nodes,
          refs: v.refs,
          help: v.help,
          message: `${v.help} (${v.nodes} element${v.nodes === 1 ? '' : 's'}${
            v.sample && v.sample.checked < v.sample.of
              ? `, among ${v.sample.checked} checked of ${v.sample.of}`
              : ''
          })`,
          severity:
            v.impact === 'critical' || v.impact === 'serious'
              ? 'major'
              : 'minor',
        });
      if (signal) out.push(signal);
    }
    return out;
  }

  // What a reading of the page's layout found (part 5). A defect the
  // session already knows on that page, about the same control and saying
  // the same thing, is not raised again: the layout is read after every
  // action, and a covered button is one fact however long it stays covered.
  fromLayout(url: string, step: number, findings: LayoutFinding[]): void {
    const page = withoutQuery(url);
    for (const finding of findings) {
      const key = JSON.stringify([
        page,
        finding.rule,
        finding.role,
        finding.name,
        // Without the measure: text that overflows by 12 px then by 14 is
        // the same text overflowing.
        finding.message.replace(/\d+ px/g, ''),
      ]);
      if (this.layoutSeen.has(key)) continue;
      this.layoutSeen.add(key);
      this.raise({
        kind: 'layout',
        url: page,
        step,
        rule: finding.rule,
        message: finding.message,
        severity: finding.severity,
        ...(finding.ref
          ? { ref: finding.ref, role: finding.role, name: finding.name }
          : {}),
      } as unknown as Draft);
    }
  }

  // Signals handed over now, outside the order of steps (an explicit audit).
  handOverNow(signals: Signal[]): Signal[] {
    return this.handOver(signals, this.currentStep + 1);
  }

  // A value typed into a credential field (R-S18).
  addSecret(text: string): void {
    if (text.length >= MIN_SECRET_LENGTH && !this.secrets.includes(text)) {
      this.secrets.push(text);
    }
  }

  // A value typed into a password field: a secret, and what makes a
  // refused request a refused sign-in (R-S14).
  addPassword(text: string): void {
    this.addSecret(text);
    if (text.length >= MIN_SECRET_LENGTH && !this.passwords.includes(text)) {
      this.passwords.push(text);
    }
  }

  // A cookie value or bearer token the session sent or was sent (R-E15).
  addToken(value: string): void {
    if (value.length >= MIN_TOKEN_LENGTH) this.addSecret(value);
  }

  // Whether a text was typed into a credential field.
  isSecret(text: string): boolean {
    return this.secrets.includes(text);
  }

  // A text with nothing in it that was typed into a credential field. Also
  // for what leaves the engine outside a signal (an action's console and
  // network errors).
  redact(text: string): string {
    if (sabotaged('signals_secrets_kept')) return text;
    let out = text;
    for (const form of this.secrets.flatMap(spellings)) {
      out = out.replaceAll(form, REDACTED);
    }
    return out;
  }

  // A copy fit to leave the engine: no query string anywhere, and nothing
  // that was typed into a credential field.
  private clean(signal: Signal, late: boolean): Signal {
    const scrub = (value: unknown): unknown => {
      if (typeof value === 'string') return this.redact(scrubUrls(value));
      if (Array.isArray(value)) return value.map(scrub);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, scrub(v)]),
        );
      }
      return value;
    };
    const copy = scrub(signal) as Signal;
    if (late) copy.late = true;
    return copy;
  }

  private handOver(signals: Signal[], firstStep: number): Signal[] {
    const out: Signal[] = [];
    for (const signal of signals) {
      const meta = this.meta.get(signal.id);
      if (!meta) continue;
      const late = signal.step < firstStep;
      if (late && !meta.delivered && sabotaged('signals_late_dropped')) {
        this.signals.splice(this.signals.indexOf(signal), 1);
        continue;
      }
      if (late && !meta.delivered) signal.late = true;
      meta.delivered = true;
      out.push(this.clean(signal, signal.late === true));
    }
    return out;
  }

  // The signals nobody has been given yet. `firstStep` is the first step of
  // the call they are delivered with: anything older is late (R-S7).
  deliver(firstStep: number): Signal[] {
    this.checkHung();
    const waiting = this.signals.filter(
      (signal) => !this.meta.get(signal.id)?.delivered,
    );
    return this.handOver(waiting, firstStep);
  }

  // Every signal raised so far on a page, delivered before or not (R-S19).
  onPage(url: string): Signal[] {
    this.checkHung();
    const page = withoutQuery(url);
    return this.handOver(
      this.signals.filter((signal) => signal.url === page),
      this.currentStep + 1,
    );
  }

  // Every signal of the session (R-S20).
  all(): Signal[] {
    this.checkHung();
    const kept = sabotaged('signals_end_dropped')
      ? this.signals.filter((signal) => this.meta.get(signal.id)?.delivered)
      : [...this.signals];
    return this.handOver(kept, this.currentStep + 1);
  }
}

// The page a request was made from, without its query string. A navigation
// is named by where it goes: the page it leaves is about to be gone.
function pageUrl(frame: Frame | null, request: Request): string {
  try {
    if (frame && !(request.isNavigationRequest() && !frame.parentFrame())) {
      return withoutQuery(frame.page().url());
    }
  } catch {
    // The frame went away with its page.
  }
  return withoutQuery(request.url());
}
