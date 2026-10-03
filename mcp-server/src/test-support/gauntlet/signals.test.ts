// The signal pages test themselves, as the rest of the gauntlet does, with
// plain Playwright and no haunt code. For every planted defect:
//   1. it is real — the browser does report it in the buggy variant;
//   2. it is the only one — nothing else is reported there, and the clean
//      variant reports nothing at all;
//   3. the traps are real — a list of raw browser events does contain the
//      duplicates and the cancelled requests that must not become signals.
// ground-truth.json is checked against what happens, not the other way round.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
  chromium,
} from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ExpectedSignal,
  type NotASignal,
  type PageTruth,
  type Trigger,
  loadGroundTruth,
} from './ground-truth.js';
import {
  type Gauntlet,
  SIGNAL_PAGES,
  type SignalPage,
  type Variant,
  startGauntlet,
} from './server.js';

const VARIANTS: Variant[] = ['buggy', 'clean'];
const SECRET = 'Zq9-hunter2-xK';

// The defaults of the specification (R-S4).
const SLOW_MS = 3_000;
const LONG_TASK_MS = 500;

// How many elements carry data-g, frames and shadow roots included.
const ACTIONABLE: Record<SignalPage, number> = {
  'sig-http': 7,
  'sig-exceptions': 6,
  'sig-network': 7,
  'sig-blocking': 2,
  'sig-dead': 10,
  'sig-a11y': 12,
  'sig-silent': 2,
  'sig-secrets': 7,
};

// One thing the browser reported, as a naive collector would record it.
interface Fact {
  kind:
    | 'http_error'
    | 'request_failed'
    | 'request_hung'
    | 'slow_response'
    | 'response_time'
    | 'js_exception'
    | 'unhandled_rejection'
    | 'console_error'
    | 'browser_console'
    | 'long_task';
  method?: string;
  path?: string;
  // The URL as the browser has it, query included.
  url?: string;
  status?: number;
  resource_type?: string;
  message?: string;
  stack?: string;
  ms?: number;
  // Path of the document it happened in.
  frame?: string;
}

// Console lines the browser writes by itself about a resource.
const BROWSER_LINE = /^(Failed to load resource|Refused to apply style)/;

interface Observer {
  facts: Fact[];
  // Requests still without a response.
  pending(): Fact[];
}

async function observe(context: BrowserContext): Promise<Observer> {
  const facts: Fact[] = [];
  const started = new Set<Request>();
  const where = (url: string) => new URL(url).pathname;

  context.on('request', (request) => started.add(request));
  context.on('response', (response) => {
    const request = response.request();
    // The browser's own measure, from sending the request to the first byte
    // of the answer: this process hears of both late when it is busy.
    const ms = Math.round(request.timing().responseStart);
    started.delete(request);
    const base = {
      method: request.method(),
      path: where(request.url()),
      url: request.url(),
      resource_type: request.resourceType(),
    };
    if (response.status() >= 400) {
      facts.push({ kind: 'http_error', ...base, status: response.status() });
    }
    if (['document', 'fetch', 'xhr'].includes(request.resourceType())) {
      facts.push({ kind: 'response_time', ...base, ms });
    }
  });
  context.on('requestfailed', (request) => {
    started.delete(request);
    facts.push({
      kind: 'request_failed',
      method: request.method(),
      path: where(request.url()),
      url: request.url(),
      message: request.failure()?.errorText,
    });
  });
  context.on('console', (message) => {
    if (message.type() !== 'error') return;
    facts.push({
      kind: BROWSER_LINE.test(message.text())
        ? 'browser_console'
        : 'console_error',
      message: message.text(),
      url: message.location().url,
    });
  });

  // Playwright's own pageerror does not tell an exception from a rejection.
  await context.exposeBinding('__fact', ({ frame }, fact: Fact) => {
    facts.push({ ...fact, frame: where(frame.url()) });
  });
  await context.addInitScript(() => {
    // biome-ignore lint/suspicious/noExplicitAny: the binding exposed above
    const report = (fact: unknown) => (window as any).__fact(fact);
    addEventListener('error', (e) =>
      report({
        kind: 'js_exception',
        message: e.message,
        stack: String(e.error?.stack),
      }),
    );
    addEventListener('unhandledrejection', (e) =>
      report({
        kind: 'unhandled_rejection',
        message: String(e.reason?.message),
        stack: String(e.reason?.stack),
      }),
    );
    // A long task of the top document is also listed in its frames.
    if (window === top) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          report({ kind: 'long_task', ms: Math.round(entry.duration) });
        }
      }).observe({ type: 'longtask', buffered: true });
    }
  });

  return {
    facts,
    pending: () =>
      [...started].map((request) => ({
        kind: 'request_hung' as const,
        method: request.method(),
        path: where(request.url()),
        url: request.url(),
      })),
  };
}

// What a collector that applies the thresholds, and nothing cleverer, would
// call signals.
function reading(facts: Fact[], longTasks: boolean): Fact[] {
  return facts.flatMap((fact): Fact[] => {
    if (fact.kind === 'browser_console') return [];
    if (fact.kind === 'response_time') {
      return (fact.ms ?? 0) >= SLOW_MS
        ? [{ ...fact, kind: 'slow_response' }]
        : [];
    }
    if (fact.kind === 'long_task') {
      return longTasks && (fact.ms ?? 0) >= LONG_TASK_MS ? [fact] : [];
    }
    return [fact];
  });
}

function fits(fact: Fact, expected: ExpectedSignal): boolean {
  const { signal, contains, starts_with, at_least } = expected;
  if (fact.kind !== signal.kind) return false;
  for (const key of ['method', 'path', 'status', 'resource_type'] as const) {
    if (signal[key] !== undefined && fact[key] !== signal[key]) return false;
  }
  if (signal.source_path !== undefined && fact.frame !== signal.source_path) {
    return false;
  }
  if (contains && !fact.message?.includes(contains.message)) return false;
  if (starts_with && !fact.path?.startsWith(starts_with.path)) return false;
  if (at_least && !((fact.ms ?? 0) >= at_least.duration_ms)) return false;
  return true;
}

// Removes from `facts` what `expected` accounts for and returns what it
// could not find.
function account(facts: Fact[], expected: ExpectedSignal[]): string[] {
  const missing: string[] = [];
  for (const one of expected) {
    const count = (one.signal.count as number | undefined) ?? 1;
    for (let i = 0; i < count; i++) {
      const at = facts.findIndex((fact) => fits(fact, one));
      if (at === -1) {
        missing.push(JSON.stringify(one));
        break;
      }
      facts.splice(at, 1);
    }
  }
  return missing;
}

// Removes from `facts` one fact per trap and returns the traps the browser
// did not report.
function discard(facts: Fact[], traps: NotASignal[] = []): string[] {
  const missing: string[] = [];
  for (const trap of traps) {
    const at = facts.findIndex(
      (fact) =>
        fact.kind === trap.kind &&
        (trap.path === undefined || fact.path === trap.path),
    );
    if (at === -1) missing.push(trap.why);
    else facts.splice(at, 1);
  }
  return missing;
}

// An audit or a comparison of the page shows these, not an event.
const fromEvents = (signals: ExpectedSignal[]) =>
  signals.filter((s) => !['a11y', 'dead_control'].includes(s.signal.kind));

// The browser writes a console line of its own for every failed request.
const browserLines = (signals: ExpectedSignal[]) =>
  signals
    .filter((s) => ['http_error', 'request_failed'].includes(s.signal.kind))
    .reduce((n, s) => n + ((s.signal.count as number | undefined) ?? 1), 0);

const lines = (facts: Fact[]) =>
  facts.filter((f) => f.kind === 'browser_console').length;

// What was measured for a defect planted under its threshold.
function underThreshold(raw: Fact[], under: ExpectedSignal): Fact[] {
  const slow = under.signal.kind === 'slow_response';
  return raw.filter(
    (f) =>
      f.kind === (slow ? 'response_time' : 'long_task') &&
      (!slow || f.path === under.signal.path) &&
      (f.ms ?? 0) >= (under.at_least?.duration_ms ?? 0),
  );
}

// Waits until the browser has reported what is expected. Gives up quietly:
// the assertions that follow say what is missing.
async function until(page: Page, done: () => boolean): Promise<void> {
  const end = Date.now() + 10_000;
  while (!done() && Date.now() < end) await page.waitForTimeout(50);
  // What should not come has had the time to.
  await page.waitForTimeout(250);
}

describe('gauntlet signal pages', { timeout: 60_000 }, () => {
  let gauntlet: Gauntlet;
  let browser: Browser;
  const truth = loadGroundTruth();
  const axeSource = readFileSync(
    createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
    'utf-8',
  );

  beforeAll(async () => {
    gauntlet = await startGauntlet();
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
    await gauntlet.close();
  });

  async function open(name: SignalPage, variant: Variant) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const observer = await observe(context);
    const page = await context.newPage();
    await page.goto(gauntlet.url(name, `variant=${variant}`));
    const buggy = variant === 'buggy';
    const load = buggy ? fromEvents(truth[name].load) : [];
    const frames = await page.locator('iframe').count();
    await until(page, () => {
      const seen = reading(observer.facts, true);
      return (
        page.frames().length === frames + 1 &&
        account(seen, load).length === 0 &&
        discard(seen, buggy ? truth[name].load_same_fact : []).length === 0 &&
        lines(observer.facts) >= browserLines(load)
      );
    });
    return { context, page, observer };
  }

  const control = (page: Page, trigger: Pick<Trigger, 'trigger' | 'frame'>) =>
    (trigger.frame
      ? page.frameLocator(`[data-frame="${trigger.frame}"]`)
      : page
    ).locator(`[data-g="${trigger.trigger}"]`);

  const visibleText = async (page: Page) =>
    (
      await Promise.all(
        page
          .frames()
          .map((frame) =>
            frame.evaluate(() => document.body.innerText).catch(() => ''),
          ),
      )
    ).join('\n');

  // Loads the page in a context of its own, clicks one control, and returns
  // what the browser reported at load and after the click.
  async function run(name: SignalPage, variant: Variant, trigger: Trigger) {
    const { context, page, observer } = await open(name, variant);
    try {
      const field = truth[name].secret_field;
      if (field) await page.locator(`[data-g="${field}"]`).fill(SECRET);

      const loaded = observer.facts.splice(0);
      const before = await visibleText(page);
      await control(page, trigger).click();

      const buggy = variant === 'buggy';
      const signals = buggy ? fromEvents(trigger.signals) : [];
      const traps =
        buggy || trigger.both_variants
          ? [...(trigger.not_a_failure ?? []), ...(trigger.same_fact ?? [])]
          : [];
      await until(page, () => {
        const seen = [...reading(observer.facts, true), ...observer.pending()];
        return (
          account(seen, signals).length === 0 &&
          discard(seen, traps).length === 0 &&
          lines(observer.facts) >= browserLines(signals) &&
          (!buggy ||
            (trigger.under_threshold ?? []).every(
              (under) => underThreshold(observer.facts, under).length > 0,
            ))
        );
      });
      const after = await visibleText(page);
      return {
        loaded,
        raw: [...observer.facts],
        hung: observer.pending(),
        feedback: after !== before,
      };
    } finally {
      await context.close();
    }
  }

  it('describes every signal page, and only controls that exist', async () => {
    expect(Object.keys(truth).sort()).toEqual([...SIGNAL_PAGES].sort());
    for (const name of SIGNAL_PAGES) {
      for (const variant of VARIANTS) {
        const { context, page } = await open(name, variant);
        const ids: string[] = [];
        for (const frame of page.frames()) {
          ids.push(...(await frame.evaluate(() => window.__gauntlet.ids())));
        }
        const label = `${name} ${variant}`;
        expect(new Set(ids).size, `${label} duplicate data-g`).toBe(ids.length);
        expect(ids.length, label).toBe(ACTIONABLE[name]);
        for (const trigger of truth[name].triggers) {
          expect(ids, label).toContain(trigger.trigger);
        }
        for (const element of truth[name].load.flatMap(
          (s) => s.elements ?? [],
        )) {
          expect(ids, label).toContain(element.id);
        }
        await context.close();
      }
    }
  });

  it('serves the buggy variant unless asked for the clean one', async () => {
    const get = async (path: string) =>
      (await fetch(`${gauntlet.baseUrl}${path}`)).status;
    expect(await get('/sig/api/orders')).toBe(500);
    expect(await get('/sig/api/orders?variant=buggy')).toBe(500);
    expect(await get('/sig/api/orders?variant=clean')).toBe(200);
    expect(await get('/sig/api/nope?variant=clean')).toBe(404);

    const body = async (query: string) =>
      (await fetch(`${gauntlet.baseUrl}/sig-a11y${query}`)).text();
    expect(await body('')).toBe(await body('?variant=buggy'));
    expect(await body('')).toContain('<html>');
    expect(await body('?variant=clean')).toContain('<html lang="en">');
    // No marker of the variant syntax is left in what is served.
    for (const name of SIGNAL_PAGES) {
      for (const variant of VARIANTS) {
        const html = await (
          await fetch(gauntlet.url(name, `variant=${variant}`))
        ).text();
        expect(html, `${name} ${variant}`).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  describe.each(SIGNAL_PAGES.filter((name) => truth[name].triggers.length > 0))(
    '%s',
    (name) => {
      const page: PageTruth = truth[name];
      // The only page where the main thread is the subject. Elsewhere a busy
      // machine must not be able to plant a long task of its own, and the
      // controls can be tried side by side.
      const longTasks = name === 'sig-blocking';
      const runAll = async (variant: Variant) => {
        if (!longTasks) {
          return Promise.all(page.triggers.map((t) => run(name, variant, t)));
        }
        const results = [];
        for (const trigger of page.triggers) {
          results.push(await run(name, variant, trigger));
        }
        return results;
      };

      it('buggy: the browser reports each planted defect and nothing else', async () => {
        const results = await runAll('buggy');
        for (const [i, trigger] of page.triggers.entries()) {
          const { loaded, raw, hung, feedback } = results[i];
          const label = `${name} ${trigger.trigger}`;

          const atLoad = reading(loaded, longTasks);
          expect(
            account(atLoad, fromEvents(page.load)),
            `${label}, load`,
          ).toEqual([]);
          expect(
            discard(atLoad, page.load_same_fact),
            `${label}, load`,
          ).toEqual([]);
          expect(atLoad, `${label}, extra at load`).toEqual([]);

          const seen = [...reading(raw, longTasks), ...hung];
          expect(account(seen, fromEvents(trigger.signals)), label).toEqual([]);
          // The traps: in the browser's events, and not signals.
          expect(
            discard(seen, [
              ...(trigger.not_a_failure ?? []),
              ...(trigger.same_fact ?? []),
            ]),
            label,
          ).toEqual([]);
          expect(seen, `${label}, extra`).toEqual([]);

          // One more trap: the browser's own console line about a failed
          // request, which is the same fact again.
          expect(lines(loaded), `${label}, load`).toBe(browserLines(page.load));
          expect(lines(raw), label).toBe(browserLines(trigger.signals));

          for (const { signal } of trigger.signals) {
            if (signal.feedback !== undefined) {
              expect(feedback, `${label}, feedback`).toBe(signal.feedback);
            }
          }

          // Measurable, and under the default threshold.
          for (const under of trigger.under_threshold ?? []) {
            const slow = under.signal.kind === 'slow_response';
            const measured = underThreshold(raw, under);
            expect(measured, `${label}, under the threshold`).toHaveLength(1);
            expect(measured[0].ms).toBeLessThan(slow ? SLOW_MS : LONG_TASK_MS);
          }

          // What was typed is in what the browser reports, as it stands.
          if (page.secret_field) {
            expect(JSON.stringify(raw), label).toContain(SECRET);
          }
        }
      });

      it('clean: the browser reports nothing', async () => {
        const results = await runAll('clean');
        for (const [i, trigger] of page.triggers.entries()) {
          const { loaded, raw, hung } = results[i];
          const label = `${name} ${trigger.trigger}`;
          expect(reading(loaded, longTasks), `${label}, load`).toEqual([]);

          const seen = [...reading(raw, longTasks), ...hung];
          if (trigger.both_variants) {
            expect(discard(seen, trigger.not_a_failure), label).toEqual([]);
          }
          expect(seen, label).toEqual([]);
          expect(
            [...loaded, ...raw].filter((f) => f.kind === 'browser_console'),
            label,
          ).toEqual([]);
        }
      });
    },
  );

  describe('sig-dead', () => {
    const triggers = truth['sig-dead'].triggers;
    const dead = triggers.filter((t) => t.signals.length > 0);
    const working = triggers.filter((t) => t.signals.length === 0);

    // Everything a click could have changed.
    const state = (page: Page) =>
      page.evaluate(() => ({
        html: document.body.outerHTML,
        path: location.pathname,
        focus: document.activeElement?.getAttribute('data-g') ?? null,
        scroll: [scrollX, scrollY, document.getElementById('log')?.scrollTop],
      }));

    async function click(variant: Variant, trigger: Trigger) {
      const { context, page } = await open('sig-dead', variant);
      const before = await state(page);
      await control(page, trigger).click();
      if (trigger.effect === 'navigation') {
        await page.waitForURL((url) => url.pathname !== before.path);
      }
      await page.waitForTimeout(300);
      const after = await state(page);
      await context.close();
      return { before, after };
    }

    it('has three controls a click changes nothing on', async () => {
      expect(dead.map((t) => t.trigger)).toEqual([
        'refresh',
        'help',
        'tab-billing',
      ]);
      for (const trigger of dead) {
        const { before, after } = await click('buggy', trigger);
        // The click took the focus, as it does on any control, and nothing
        // else moved.
        expect(after, trigger.trigger).toEqual({
          ...before,
          focus: trigger.trigger,
        });
      }
    });

    it('names them as the ground truth says', async () => {
      const { context, page } = await open('sig-dead', 'buggy');
      for (const trigger of dead) {
        const { role, name } = trigger.signals[0].signal as unknown as {
          role: Parameters<Page['getByRole']>[0];
          name: string;
        };
        const found = page.getByRole(role, { name, exact: true });
        expect(await found.getAttribute('data-g')).toBe(trigger.trigger);
      }
      await context.close();
    });

    it('has working controls beside them, two of which change no text', async () => {
      expect(working.map((t) => t.effect).sort()).toEqual([
        'focus',
        'navigation',
        'scroll',
        'text',
        'text',
      ]);
      for (const trigger of working) {
        const { before, after } = await click('buggy', trigger);
        const label = trigger.trigger;
        if (trigger.effect === 'text') {
          expect(after.html, label).not.toBe(before.html);
        } else if (trigger.effect === 'navigation') {
          expect(after.path, label).not.toBe(before.path);
        } else if (trigger.effect === 'focus') {
          expect(after, label).toEqual({ ...before, focus: 'search' });
        } else {
          expect(after.scroll, label).not.toEqual(before.scroll);
          expect(after.html, label).toBe(before.html);
        }
      }
    });

    it('clean: the same three controls work', async () => {
      for (const trigger of dead) {
        const { before, after } = await click('clean', trigger);
        expect(after.html, trigger.trigger).not.toBe(before.html);
      }
    });
  });

  describe('accessibility', () => {
    interface Violation {
      rule: string;
      impact: string;
      elements: string[];
    }

    // axe-core with the WCAG 2 A and AA rules (R-S15), in every frame.
    async function audit(name: SignalPage, variant: Variant) {
      const { context, page } = await open(name, variant);
      for (const frame of page.frames()) await frame.evaluate(axeSource);
      const violations: Violation[] = await page.evaluate(async () => {
        // biome-ignore lint/suspicious/noExplicitAny: axe, injected above
        const results = await (window as any).axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
        // biome-ignore lint/suspicious/noExplicitAny: axe's result
        return results.violations.map((v: any) => ({
          rule: v.id,
          impact: v.impact,
          elements: v.nodes
            // biome-ignore lint/suspicious/noExplicitAny: axe's result
            .map((n: any) => /data-g="([^"]+)"/.exec(n.html)?.[1])
            .filter(Boolean)
            .sort(),
        }));
      });
      await context.close();
      return violations.sort((a, b) => a.rule.localeCompare(b.rule));
    }

    it('sig-a11y buggy breaks its twelve rules, on the elements listed', async () => {
      const expected = truth['sig-a11y'].load
        .map((s) => ({
          rule: s.signal.rule,
          impact: s.signal.impact,
          elements: (s.elements ?? []).map((e) => e.id).sort(),
        }))
        .sort((a, b) => String(a.rule).localeCompare(String(b.rule)));
      expect(expected).toHaveLength(12);
      expect(await audit('sig-a11y', 'buggy')).toEqual(expected);
      // Critical and serious are major by default (R-S3).
      for (const { signal } of truth['sig-a11y'].load) {
        expect(signal.severity).toBe(
          ['critical', 'serious'].includes(String(signal.impact))
            ? 'major'
            : 'minor',
        );
      }
    });

    it('every other signal page, and every clean variant, breaks none', async () => {
      const audits = await Promise.all(
        SIGNAL_PAGES.flatMap((name) =>
          VARIANTS.filter((v) => !(name === 'sig-a11y' && v === 'buggy')).map(
            async (variant) => ({
              page: `${name} ${variant}`,
              violations: await audit(name, variant),
            }),
          ),
        ),
      );
      expect(audits.filter((a) => a.violations.length > 0)).toEqual([]);
    });
  });
});
