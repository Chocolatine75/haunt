// The tester pages test themselves with plain Playwright and no haunt code,
// as the signal and evidence pages do. For every page:
//   1. its controls are the ones tester-truth.json lists, with the role,
//      name and state given there;
//   2. each case's steps lead to a page where the check fails in the buggy
//      variant and holds in the clean one, reading exactly what the truth
//      says is read;
//   3. the defect is silent: no failed request, no exception, no console
//      error, no accessibility violation. Nothing but the check finds it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Gauntlet,
  TESTER_PAGES,
  type TesterPage,
  type Variant,
  startGauntlet,
} from './server.js';
import {
  type TesterCheck,
  type TesterStep,
  loadTesterTruth,
} from './tester-truth.js';

// The first number in a text, as a price or a count is written.
const numberIn = (text: string) =>
  Number((/-?\d[\d,]*(\.\d+)?/.exec(text)?.[0] ?? 'NaN').replaceAll(',', ''));

function sorted(
  items: string[],
  order: 'ascending' | 'descending',
  as: 'number' | 'text',
): boolean {
  const keys: Array<number | string> =
    as === 'number' ? items.map(numberIn) : items;
  return keys.every((key, i) => {
    if (i === 0) return true;
    const before = keys[i - 1];
    return order === 'ascending' ? before <= key : before >= key;
  });
}

describe('gauntlet tester pages', { timeout: 120_000 }, () => {
  let gauntlet: Gauntlet;
  let browser: Browser;
  const truth = loadTesterTruth();
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

  async function open(name: TesterPage, variant: Variant) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const noise: string[] = [];
    page.on('pageerror', (error) => noise.push(`exception: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') noise.push(`console: ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400)
        noise.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) =>
      noise.push(`failed ${request.url()}`),
    );
    await page.goto(gauntlet.url(name, `variant=${variant}`));
    return { context, page, noise };
  }

  const control = (page: Page, g: string) => page.locator(`[data-g="${g}"]`);

  async function run(page: Page, steps: TesterStep[]) {
    for (const step of steps) {
      const target = step.target ? control(page, step.target) : undefined;
      if (step.type === 'press') await page.keyboard.press(step.keys ?? '');
      else if (!target) throw new Error(`a ${step.type} needs a target`);
      else if (step.type === 'click') await target.click();
      else if (step.type === 'check') await target.check();
      else if (step.type === 'select')
        await target.selectOption({ label: step.values?.[0] ?? '' });
      else await target.fill(step.text ?? '');
    }
  }

  // Whether the check holds, and what it read.
  async function evaluate(
    page: Page,
    check: TesterCheck,
  ): Promise<{ held: boolean; read?: unknown }> {
    if (check.text_present !== undefined) {
      const text = await page.locator('body').innerText();
      return { held: text.includes(check.text_present) };
    }
    if (check.value) {
      const target = control(page, check.value.target);
      const read =
        check.value.of === 'focused'
          ? await target.evaluate((el) => el === document.activeElement)
          : check.value.of === 'checked'
            ? await target.isChecked()
            : await target.inputValue();
      return { held: read === check.value.is, read };
    }
    if (!check.list) throw new Error('a check of no kind');
    const { within, items, ...condition } = check.list;
    const read = (
      await page
        // biome-ignore lint/suspicious/noExplicitAny: a role from the truth file
        .getByRole(within.role as any, { name: within.name })
        // biome-ignore lint/suspicious/noExplicitAny: a role from the truth file
        .getByRole(items as any)
        .allInnerTexts()
    ).map((text) => text.trim());
    const has = (text: string, part: string) =>
      text.toLowerCase().includes(part.toLowerCase());
    const { count, every_contains, none_contains, order, as, equals } =
      condition;
    const held =
      (count?.eq === undefined || read.length === count.eq) &&
      (count?.min === undefined || read.length >= count.min) &&
      (count?.max === undefined || read.length <= count.max) &&
      (every_contains === undefined ||
        read.every((text) => has(text, every_contains))) &&
      (none_contains === undefined ||
        !read.some((text) => has(text, none_contains))) &&
      (order === undefined || sorted(read, order, as ?? 'text')) &&
      (equals === undefined || JSON.stringify(read) === JSON.stringify(equals));
    return { held, read };
  }

  for (const name of TESTER_PAGES) {
    const page = truth[name];

    it(`${name}: its controls are the ones listed, and no other`, async () => {
      for (const variant of ['buggy', 'clean'] as const) {
        const { context, page: tab } = await open(name, variant);
        expect(
          (await tab.evaluate(() => window.__gauntlet.ids())).sort(),
          variant,
        ).toEqual(
          [
            ...page.controls.map((c) => c.g),
            // Containers the page's own script looks up, not controls.
            ...(await tab.evaluate(() =>
              window.__gauntlet
                .elements()
                .filter(
                  (el: Element) =>
                    !el.matches('a, button, input, select, textarea'),
                )
                .map((el: Element) => el.getAttribute('data-g')),
            )),
          ].sort(),
        );
        for (const c of page.controls) {
          const byRole = tab.getByRole(
            // biome-ignore lint/suspicious/noExplicitAny: a role from the truth file
            c.role as any,
            { name: c.name, exact: true, includeHidden: true },
          );
          expect(
            await byRole.evaluateAll((els) =>
              els.map((el) => el.getAttribute('data-g')),
            ),
            `${c.role} "${c.name}"`,
          ).toEqual([c.g]);
          expect(await control(tab, c.g).isVisible(), `${c.g} visible`).toBe(
            c.state !== 'hidden',
          );
          if (c.state !== 'hidden') {
            expect(
              await control(tab, c.g).isDisabled(),
              `${c.g} disabled`,
            ).toBe(c.state === 'disabled');
          }
        }
        if (page.opens) {
          await control(tab, page.opens.by).click();
          for (const g of page.opens.controls) {
            expect(await control(tab, g).isVisible(), `${g} once open`).toBe(
              true,
            );
          }
        }
        await context.close();
      }
    });

    for (const one of page.cases) {
      for (const variant of ['buggy', 'clean'] as const) {
        it(`${name} ${variant}: "${one.id}" ${variant === 'buggy' ? 'fails' : 'holds'}, in silence`, async () => {
          const { context, page: tab, noise } = await open(name, variant);
          await run(tab, one.steps);
          const { held, read } = await evaluate(tab, one.check);
          expect(held, JSON.stringify(read)).toBe(variant === 'clean');
          if (one.read) expect(read).toEqual(one.read[variant]);
          expect(noise).toEqual([]);
          await context.close();
        });
      }
    }
  }

  it('every case names controls of its page, and plays only those', () => {
    for (const name of TESTER_PAGES) {
      const known = new Set(truth[name].controls.map((c) => c.g));
      for (const one of truth[name].cases) {
        for (const g of one.controls) expect(known.has(g), g).toBe(true);
        for (const step of one.steps) {
          if (step.target)
            expect(known.has(step.target), step.target).toBe(true);
        }
      }
    }
  });

  it('no tester page breaks an accessibility rule, its dialog open or not', async () => {
    const violations: string[] = [];
    for (const name of TESTER_PAGES) {
      for (const variant of ['buggy', 'clean'] as const) {
        const { context, page: tab } = await open(name, variant);
        const audit = async () => {
          await tab.evaluate(axeSource);
          const found: string[] = await tab.evaluate(async () => {
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
        const { opens } = truth[name];
        if (opens) {
          await control(tab, opens.by).click();
          await audit();
        }
        for (const one of truth[name].cases) await run(tab, one.steps);
        await audit();
        await context.close();
      }
    }
    expect(violations).toEqual([]);
  });
});
