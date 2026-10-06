// The layout pages test themselves with plain Playwright and no haunt code:
// the defect each plants is really there in the buggy variant, as a fact of
// geometry, and really absent from the clean one; and what each sets beside
// it as a look-alike is really what it claims to be.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Gauntlet,
  LAYOUT_PAGES,
  type LayoutPage,
  type Variant,
  startGauntlet,
} from './server.js';

describe('gauntlet layout pages', { timeout: 120_000 }, () => {
  let gauntlet: Gauntlet;
  let browser: Browser;
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

  async function open(name: LayoutPage, variant: Variant, width = 1280) {
    const context = await browser.newContext({
      viewport: { width, height: 720 },
    });
    const page = await context.newPage();
    await page.goto(gauntlet.url(name, `variant=${variant}`));
    return { context, page };
  }

  // data-g of what a click at the centre of a control would land on.
  const hitAt = (page: Page, g: string) =>
    page.evaluate((id) => {
      const el = document.querySelector(`[data-g="${id}"]`);
      if (!el) return 'missing';
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return top?.closest('[data-g]')?.getAttribute('data-g') ?? 'nothing';
    }, g);

  const box = (page: Page, g: string) =>
    page.evaluate((id) => {
      const r = document
        .querySelector(`[data-g="${id}"]`)
        ?.getBoundingClientRect();
      return r
        ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        : { left: 0, top: 0, right: 0, bottom: 0 };
    }, g);

  it('lay-covered: the bar takes the click on "Stop sharing", and scrolling changes nothing', async () => {
    for (const variant of ['buggy', 'clean'] as const) {
      const { context, page } = await open('lay-covered', variant);
      const expected = variant === 'buggy' ? 'bar' : 'stop-sharing';
      expect(await hitAt(page, 'stop-sharing'), variant).toBe(expected);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(100);
      expect(await hitAt(page, 'stop-sharing'), `${variant} scrolled`).toBe(
        expected,
      );
      // The look-alikes: a header content scrolls under, a menu over the
      // page, a backdrop, a message.
      expect(await hitAt(page, 'invite')).not.toBe('invite');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('[data-g="menu"]').click();
      expect(await hitAt(page, 'invite')).not.toBe('invite');
      await page.locator('[data-g="menu"]').click();
      await page.locator('[data-g="panel-open"]').click();
      expect(await hitAt(page, 'invite')).toBe('nothing');
      await context.close();
    }
  });

  it('lay-overlap: the two zoom buttons share most of a box, and nothing else does', async () => {
    const shared = async (page: Page, a: string, b: string) => {
      const [x, y] = [await box(page, a), await box(page, b)];
      const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
      const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      const area = (r: typeof x) => (r.right - r.left) * (r.bottom - r.top);
      return w > 0 && h > 0 ? (w * h) / Math.min(area(x), area(y)) : 0;
    };
    for (const variant of ['buggy', 'clean'] as const) {
      const { context, page } = await open('lay-overlap', variant);
      const zoom = await shared(page, 'zoom-in', 'zoom-out');
      if (variant === 'buggy') expect(zoom).toBeGreaterThan(0.5);
      else expect(zoom).toBe(0);
      // A badge on a corner: some, and less than half of it.
      const badge = await shared(page, 'inbox', 'badge');
      expect(badge).toBeGreaterThan(0);
      expect(badge).toBeLessThan(0.5);
      // Links that wrap: more than one box each.
      expect(
        await page.evaluate(
          () =>
            document.querySelector('[data-g="terms"]')?.getClientRects()
              .length ?? 0,
        ),
      ).toBeGreaterThan(1);
      await context.close();
    }
  });

  it('lay-text: a label wider than its button, a price taller than its box', async () => {
    for (const variant of ['buggy', 'clean'] as const) {
      const { context, page } = await open('lay-text', variant);
      const measured = await page.evaluate(() => {
        const of = (g: string) =>
          document.querySelector(`[data-g="${g}"]`) as HTMLElement;
        const label = document.createRange();
        label.selectNodeContents(of('export'));
        return {
          spill:
            label.getBoundingClientRect().right -
            of('export').getBoundingClientRect().right,
          cut: of('price').scrollHeight - of('price').clientHeight,
          // The look-alikes.
          ellipsis: of('title').scrollWidth - of('title').clientWidth,
          log: of('log').scrollWidth - of('log').clientWidth,
          skip: of('skip').getBoundingClientRect().width,
        };
      });
      if (variant === 'buggy') {
        expect(measured.spill).toBeGreaterThan(20);
        expect(measured.cut).toBeGreaterThan(10);
      } else {
        expect(measured.spill).toBeLessThanOrEqual(0);
        expect(measured.cut).toBeLessThanOrEqual(1);
      }
      expect(measured.ellipsis).toBeGreaterThan(20);
      expect(measured.log).toBeGreaterThan(20);
      expect(measured.skip).toBeLessThanOrEqual(1);
      await context.close();
    }
  });

  it('lay-dialog: the payment dialog opens below the window, or in it', async () => {
    for (const variant of ['buggy', 'clean'] as const) {
      const { context, page } = await open('lay-dialog', variant);
      await page.locator('[data-g="subscribe"]').click();
      const { top, bottom } = await box(page, 'dialog');
      if (variant === 'buggy') expect(top).toBeGreaterThan(720);
      else {
        expect(top).toBeGreaterThanOrEqual(0);
        expect(bottom).toBeLessThanOrEqual(720);
      }
      await context.close();
    }
  });

  it('lay-narrow: at 375 px the page is wider than the window; at 1280 it is not, table and all', async () => {
    const over = (page: Page) =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    for (const variant of ['buggy', 'clean'] as const) {
      const phone = await open('lay-narrow', variant, 375);
      if (variant === 'buggy')
        expect(await over(phone.page)).toBeGreaterThan(200);
      else expect(await over(phone.page)).toBeLessThanOrEqual(0);
      await phone.context.close();
      const desk = await open('lay-narrow', variant);
      expect(await over(desk.page)).toBeLessThanOrEqual(0);
      await desk.context.close();
    }
  });

  it('no layout page breaks an accessibility rule', async () => {
    const violations: string[] = [];
    for (const name of LAYOUT_PAGES) {
      for (const variant of ['buggy', 'clean'] as const) {
        const { context, page } = await open(name, variant);
        await page.evaluate(axeSource);
        const found: string[] = await page.evaluate(async () => {
          // biome-ignore lint/suspicious/noExplicitAny: axe, injected above
          const results = await (window as any).axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
          });
          // biome-ignore lint/suspicious/noExplicitAny: axe's result
          return results.violations.map((v: any) => v.id);
        });
        violations.push(...found.map((rule) => `${name} ${variant} ${rule}`));
        await context.close();
      }
    }
    expect(violations).toEqual([]);
  });
});
