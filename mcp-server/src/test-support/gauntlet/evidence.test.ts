// The evidence pages test themselves with plain Playwright and no haunt
// code, as the signal pages do. For every page:
//   1. the steps of evidence-truth.json do produce each claim in the buggy
//      variant, and none of them in the clean one;
//   2. what makes it hard is real: ev-sequence needs all three steps,
//      ev-flaky fails on exactly one save in five, ev-login needs the
//      credentials typed again;
//   3. the pages themselves break no accessibility rule, so that an audit
//      adds nothing a gate test does not expect.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { type Browser, type Frame, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EV_LOGIN } from './evidence-routes.js';
import {
  type EvidenceClaim,
  type EvidenceStep,
  loadEvidenceTruth,
} from './evidence-truth.js';
import {
  EVIDENCE_PAGES,
  type EvidencePage,
  type Gauntlet,
  type Variant,
  startGauntlet,
} from './server.js';

// What happened on a page, as the claims are about it.
interface Seen {
  responses: Array<{ path: string; status: number }>;
  errors: string[];
  page: Page;
}

// Requests each page has on the wire.
const inflight = new WeakMap<Page, number>();

describe('gauntlet evidence pages', { timeout: 120_000 }, () => {
  let gauntlet: Gauntlet;
  let browser: Browser;
  const truth = loadEvidenceTruth();
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

  async function open(name: EvidencePage, variant: Variant, query?: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const seen: Seen = { responses: [], errors: [], page };
    inflight.set(page, 0);
    const done = () => inflight.set(page, (inflight.get(page) ?? 1) - 1);
    page.on('request', () => inflight.set(page, (inflight.get(page) ?? 0) + 1));
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    page.on('response', (response) => {
      seen.responses.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
    });
    page.on('pageerror', (error) => seen.errors.push(error.message));
    const q = [`variant=${variant}`, query].filter(Boolean).join('&');
    await page.goto(gauntlet.url(name, q));
    return { context, seen };
  }

  const frameOf = (page: Page, name?: string): Frame | Page => {
    if (!name) return page;
    const frame = page
      .frames()
      .find((f) => f.url().includes(`/frame/ev-${name}`));
    if (!frame) throw new Error(`no frame ${name}`);
    return frame;
  };

  async function run(page: Page, steps: EvidenceStep[]) {
    for (const step of steps) {
      for (let i = 0; i < (step.repeat ?? 1); i++) {
        const target = frameOf(page, step.frame).locator(
          `[data-g="${step.target}"]`,
        );
        if (step.type === 'click') await target.click();
        else if (step.type === 'select')
          await target.selectOption({ label: step.values?.[0] ?? '' });
        else
          await target.fill(
            step.secret ? EV_LOGIN[step.secret] : (step.text ?? ''),
          );
      }
    }
    // "networkidle" is already reached when the last click starts its
    // request: wait for the requests themselves.
    while (inflight.get(page)) await page.waitForTimeout(50);
    await page.waitForTimeout(100);
  }

  async function holds(seen: Seen, claim: EvidenceClaim): Promise<boolean> {
    if ('signal' in claim) {
      const { kind, path, status, message_contains } = claim.signal;
      if (kind === 'http_error') {
        return seen.responses.some(
          (r) => r.path === path && r.status === status,
        );
      }
      return seen.errors.some((m) => m.includes(message_contains ?? ''));
    }
    const text = await seen.page.locator('body').innerText();
    const { text_absent, text_present } = claim.observed;
    if (text_absent !== undefined) return !text.includes(text_absent);
    return text.includes(text_present ?? '');
  }

  for (const name of EVIDENCE_PAGES) {
    const page = truth[name];
    for (const variant of ['buggy', 'clean'] as const) {
      it(`${name} ${variant}: the steps ${variant === 'buggy' ? 'produce every claim' : 'produce none'}`, async () => {
        // A run of ev-flaky of its own, so that its first save fails.
        const query = page.query?.replace(
          'run=gauntlet',
          `run=${name}-${variant}`,
        );
        const { context, seen } = await open(name, variant, query);
        await run(seen.page, page.steps);
        if (page.wait_ms) await seen.page.waitForTimeout(page.wait_ms + 500);
        for (const claim of page.claims) {
          expect(await holds(seen, claim), JSON.stringify(claim)).toBe(
            variant === 'buggy',
          );
        }
        await context.close();
      });
    }
  }

  it('ev-sequence fails with all three steps and with no two of them', async () => {
    const [fill, select, submit] = truth['ev-sequence'].steps;
    const claim = truth['ev-sequence'].claims[0];
    for (const steps of [
      [fill, submit],
      [select, submit],
      [fill, select],
    ]) {
      const { context, seen } = await open('ev-sequence', 'buggy');
      await run(seen.page, steps);
      expect(
        await holds(seen, claim),
        steps.map((s) => s.target).join('+'),
      ).toBe(false);
      await context.close();
    }
  });

  it('ev-flaky fails on the first save of a run, then on two of the next ten', async () => {
    const claim = truth['ev-flaky'].claims[0];
    const outcomes: boolean[] = [];
    for (let i = 0; i < 11; i++) {
      const { context, seen } = await open('ev-flaky', 'buggy', 'run=rate');
      await run(seen.page, truth['ev-flaky'].steps);
      outcomes.push(await holds(seen, claim));
      await context.close();
    }
    expect(outcomes[0]).toBe(true);
    expect(outcomes.slice(1).filter(Boolean)).toHaveLength(2);
  });

  it('ev-login hides its failure from a visitor who does not sign in', async () => {
    const { context, seen } = await open('ev-login', 'buggy');
    expect(await seen.page.locator('[data-g="export"]').count()).toBe(0);
    await run(seen.page, [
      { type: 'fill', target: 'email', text: EV_LOGIN.email },
      { type: 'fill', target: 'password', text: 'not the password' },
      { type: 'click', target: 'sign-in' },
    ]);
    expect(await seen.page.locator('[data-g="export"]').count()).toBe(0);
    await context.close();
  });

  it('no evidence page breaks an accessibility rule, signed in or not', async () => {
    const violations: string[] = [];
    for (const name of EVIDENCE_PAGES) {
      for (const variant of ['buggy', 'clean'] as const) {
        const { context, seen } = await open(name, variant);
        const audit = async () => {
          for (const frame of seen.page.frames())
            await frame.evaluate(axeSource);
          const found: string[] = await seen.page.evaluate(async () => {
            // biome-ignore lint/suspicious/noExplicitAny: axe, injected above
            const results = await (window as any).axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
            });
            // biome-ignore lint/suspicious/noExplicitAny: axe's result
            return results.violations.map((v: any) => v.id);
          });
          violations.push(...found.map((rule) => `${name} ${variant} ${rule}`));
        };
        await audit();
        if (name === 'ev-login') {
          await run(seen.page, truth['ev-login'].steps.slice(0, 3));
          await audit();
        }
        await context.close();
      }
    }
    expect(violations).toEqual([]);
  });
});
