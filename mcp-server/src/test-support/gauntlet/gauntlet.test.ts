// The gauntlet tests itself. Two things are proven for every hard case, with
// plain Playwright and no haunt code involved:
//   1. the trap is real — the naive approach does fail on it;
//   2. the case is passable — a correct sequence of real user input succeeds.
// A gate built on a page that fails either check would be measuring nothing.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Browser,
  type BrowserContext,
  type ElementHandle,
  type Frame,
  type Page,
  chromium,
} from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  GAUNTLET_PAGES,
  type Gauntlet,
  type GauntletPage,
  startGauntlet,
} from './server.js';

interface GauntletEvent {
  type: string;
  id: string;
  detail: unknown;
}

// How many elements carry data-g when the page has settled. Pinned so that an
// edit to a page that adds or drops an actionable element is a visible change.
const ACTIONABLE: Record<GauntletPage, number> = {
  forms: 31,
  shadow: 9,
  frames: 1,
  selects: 5,
  overlays: 3,
  hover: 8,
  dnd: 10,
  upload: 4,
  scroll: 44,
  tabs: 5,
  dialogs: 6,
  dupes: 14,
  dynamic: 13,
  editor: 4,
  huge: 2000,
  states: 11,
  spa: 6,
  escape: 9,
  login: 5,
};

describe('gauntlet', { timeout: 30_000 }, () => {
  let gauntlet: Gauntlet;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let errors: string[];
  let tmp: string;

  beforeAll(async () => {
    gauntlet = await startGauntlet();
    browser = await chromium.launch();
    tmp = mkdtempSync(join(tmpdir(), 'gauntlet-'));
  });

  afterAll(async () => {
    await browser.close();
    await gauntlet.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  afterEach(async () => {
    await context?.close();
  });

  async function open(name: GauntletPage, query?: string): Promise<Page> {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(gauntlet.url(name, query));
    return page;
  }

  // Reaches elements in closed shadow roots too, which locators cannot.
  async function el(id: string, where: Page | Frame = page) {
    const handle = await where.evaluateHandle(
      (i) => window.__gauntlet.find(i),
      id,
    );
    const element = handle.asElement();
    if (!element) throw new Error(`no element with data-g="${id}"`);
    return element as ElementHandle<HTMLElement>;
  }

  const state = (where: Page | Frame = page) =>
    where.evaluate(() => window.__gauntlet.state);
  const events = (where: Page | Frame = page): Promise<GauntletEvent[]> =>
    where.evaluate(() => window.__gauntlet.events);
  const status = () => page.locator('#result').textContent();

  // What a real click at the middle of the element would land on.
  async function topElementAt(id: string): Promise<string | null> {
    return page.evaluate((i) => {
      const box = window.__gauntlet.find(i).getBoundingClientRect();
      const top = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return top?.closest('[data-g]')?.getAttribute('data-g') ?? null;
    }, id);
  }

  async function centre(id: string) {
    const box = await (await el(id)).boundingBox();
    if (!box) throw new Error(`${id} has no box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  }

  async function drag(from: { x: number; y: number }, to: typeof from) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }

  describe('every page', () => {
    it.each(GAUNTLET_PAGES)(
      '%s loads cleanly with unique ids and the pinned number of controls',
      async (name) => {
        await open(name);
        // Late content (dynamic: 2 s, frames: 1 s) is part of the page.
        await page.waitForTimeout(name === 'dynamic' ? 2_200 : 300);

        const ids: string[] = await page.evaluate(() =>
          window.__gauntlet.ids(),
        );
        expect(new Set(ids).size, 'duplicate data-g').toBe(ids.length);
        expect(ids.length).toBe(ACTIONABLE[name]);
        expect(await page.title()).toMatch(/^Gauntlet — /);
        expect(errors).toEqual([]);
      },
    );

    it('serves an index and a 404', async () => {
      await open('forms');
      const index = await page.request.get(gauntlet.baseUrl);
      expect(await index.text()).toContain('href="/overlays"');
      expect(
        (await page.request.get(`${gauntlet.baseUrl}/nope`)).status(),
      ).toBe(404);
    });

    it('records an event against the element that received it', async () => {
      await open('dupes');
      await (await el('delete-2')).click();
      const clicks = (await events()).filter((e) => e.type === 'click');
      expect(clicks).toHaveLength(1);
      expect(clicks[0].id).toBe('delete-2');
      expect(clicks[0].detail).toMatchObject({ button: 0, trusted: true });
    });

    it('tells a scripted click from a real one', async () => {
      await open('dupes');
      await page.evaluate(() => window.__gauntlet.find('delete-2').click());
      const [click] = (await events()).filter((e) => e.type === 'click');
      expect(click.detail).toMatchObject({ trusted: false });
    });
  });

  describe('escape', () => {
    it('does not contact the other origin while loading', async () => {
      const before = gauntlet.requests.other.length;
      await open('escape');
      await page.waitForTimeout(500);
      expect(gauntlet.requests.other.length).toBe(before);
    });

    it('reaches the other origin when nothing stops it', async () => {
      await open('escape');
      const before = gauntlet.requests.other.length;
      await page.locator('[data-g=fetch]').click();
      await expect.poll(status).toBe('Analytics sent');
      await page.locator('[data-g=redirect]').click();
      await page.waitForURL(/secret-in-redirect/);
      expect(gauntlet.requests.other.slice(before, before + 2)).toEqual([
        'GET /api/poll',
        'GET /tabs/child',
      ]);
    });
  });

  describe('login', () => {
    it('puts a link reading "Log in" before the real submit button', async () => {
      await open('login');
      const all = page.getByText('Log in', { exact: true });
      expect(await all.first().getAttribute('data-g')).toBe('nav-login');
      expect(await page.getByRole('button', { name: 'Log in' }).count()).toBe(
        1,
      );
    });

    it('signs in with the right credentials and refuses the wrong ones', async () => {
      await open('login');
      await page.locator('[data-g=email]').fill('ghost@example.com');
      await page.locator('[data-g=password]').fill('wrong');
      await page.locator('[data-g=submit]').click();
      await page.waitForURL(/error=1/);
      expect(await page.locator('#error').textContent()).toBe(
        'Wrong email or password',
      );

      await page.locator('[data-g=email]').fill('ghost@example.com');
      await page.locator('[data-g=password]').fill('boo-1234');
      await page.locator('[data-g=submit]').click();
      await page.waitForURL(/\/account$/);
      expect(await page.locator('h1').textContent()).toBe('Your account');
    });
  });

  describe('other traps', () => {
    it('has a button that is enabled and wired to nothing', async () => {
      await open('states');
      const before = await page.content();
      await page.locator('[data-g=dead]').click();
      expect(await page.content()).toBe(before);
    });

    it('starts a download from a plain link', async () => {
      await open('tabs');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-g=download-link]').click(),
      ]);
      expect(download.suggestedFilename()).toBe('report.csv');
    });

    it('drops the connection on /api/dead', async () => {
      await open('forms');
      const failed = await page.evaluate(() =>
        fetch('/api/dead').then(
          () => false,
          () => true,
        ),
      );
      expect(failed).toBe(true);
    });
  });

  describe('forms', () => {
    it('masked field ignores a value set directly and follows real keys', async () => {
      await open('forms');
      await page.locator('[data-g=masked]').fill('5551234567');
      expect((await state()).maskedDigits).toBe('');

      await page.locator('[data-g=masked]').fill('');
      await page.locator('[data-g=masked]').pressSequentially('5551234567');
      expect((await state()).maskedDigits).toBe('5551234567');
      expect(await page.locator('[data-g=masked]').inputValue()).toBe(
        '(555) 123-4567',
      );
    });

    it('autocomplete only reacts to key events', async () => {
      await open('forms');
      await page.locator('[data-g=city]').fill('Pa');
      expect((await state()).citySuggestions).toBeUndefined();

      await page.locator('[data-g=city]').fill('');
      await page.locator('[data-g=city]').pressSequentially('Pa');
      expect((await state()).citySuggestions).toEqual(['Paris', 'Parma']);
      await page.locator('[data-g=city-option-parma]').click();
      expect(await page.locator('[data-g=city]').inputValue()).toBe('Parma');
    });

    it('price is reformatted when focus leaves', async () => {
      await open('forms');
      await page.locator('[data-g=price]').fill('1234.5');
      expect(await page.locator('[data-g=price]').inputValue()).toBe('1234.5');
      await page.locator('[data-g=text]').focus();
      expect(await page.locator('[data-g=price]').inputValue()).toBe(
        '1,234.50',
      );
    });

    it('has one field that nothing names', async () => {
      await open('forms');
      const snapshot = await page.locator('form').ariaSnapshot();
      // Present as a bare textbox, with no name to select it by.
      expect(snapshot).toMatch(/- textbox\n/);
    });

    it('submits what was entered', async () => {
      await open('forms');
      await page.locator('[data-g=text]').fill('Ada Lovelace');
      await page.locator('[data-g=email]').fill('ada@example.com');
      await page.locator('[data-g=date]').fill('1815-12-10');
      await page.locator('[data-g=plan-pro]').check();
      await page.locator('[data-g=switch]').click();
      await page.locator('[data-g=submit]').click();

      const [submit] = (await events()).filter((e) => e.type === 'submit');
      expect(submit.detail).toMatchObject({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        date: '1815-12-10',
        plan: 'pro',
      });
      expect(
        await page.locator('[data-g=switch]').getAttribute('aria-checked'),
      ).toBe('true');
    });
  });

  describe('shadow', () => {
    it('hides the closed root from selectors but not from a user', async () => {
      await open('shadow');
      expect(await page.locator('[data-g=open-save]').count()).toBe(1);
      expect(await page.locator('[data-g=closed-save]').count()).toBe(0);

      await (await el('closed-name')).fill('Grace');
      await (await el('closed-save')).click();
      const [submit] = (await events()).filter((e) => e.type === 'submit');
      expect(submit).toMatchObject({
        id: 'closed',
        detail: { nickname: 'Grace', size: 's' },
      });
    });

    it('has a control three roots deep, behind a closed one', async () => {
      await open('shadow');
      expect(await page.locator('[data-g=deep-button]').count()).toBe(0);
      await (await el('deep-button')).click();
      expect(
        (await events()).filter((e) => e.type === 'click').map((e) => e.id),
      ).toEqual(['deep-button']);
    });
  });

  describe('frames', () => {
    const frameNamed = async (name: string) => {
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;
        const found = await frame
          .evaluate(() => window.__gauntlet?.state.name)
          .catch(() => undefined);
        if (found === name) return frame;
      }
      throw new Error(`no frame named ${name}`);
    };

    it('has same-origin, cross-origin, nested and late frames', async () => {
      await open('frames');
      expect(page.frames()).toHaveLength(5);
      await page.waitForTimeout(1_300);
      expect(page.frames()).toHaveLength(6);

      const cross = await frameNamed('cross');
      expect(new URL(cross.url()).origin).toBe(gauntlet.otherUrl);
      expect((await frameNamed('inner')).parentFrame()?.parentFrame()).toBe(
        page.mainFrame(),
      );
    });

    it.each(['same', 'cross', 'inner', 'late'])(
      'the %s frame takes input and keeps its own record',
      async (name) => {
        await open('frames');
        await page.waitForTimeout(1_300);
        const frame = await frameNamed(name);
        await frame.locator('[data-g=comment]').fill(`hello ${name}`);
        await frame.locator('[data-g=send]').click();
        expect(
          (await events(frame)).filter((e) => e.type === 'submit'),
        ).toEqual([
          expect.objectContaining({ id: name, detail: `hello ${name}` }),
        ]);
        // The top document saw none of it.
        expect((await events()).filter((e) => e.type === 'submit')).toEqual([]);
      },
    );
  });

  describe('selects', () => {
    it('has 500 options in one select', async () => {
      await open('selects');
      await page
        .locator('[data-g=native-huge]')
        .selectOption({ label: 'Country 437' });
      expect(await page.locator('[data-g=native-huge]').inputValue()).toBe(
        'c437',
      );
      expect(await page.locator('[data-g=native-huge] option').count()).toBe(
        500,
      );
    });

    it('selects several native options', async () => {
      await open('selects');
      await page
        .locator('[data-g=native-multiple]')
        .selectOption(['ham', 'olives']);
      expect(
        await page
          .locator('[data-g=native-multiple]')
          .evaluate((s: HTMLSelectElement) =>
            [...s.selectedOptions].map((o) => o.value),
          ),
      ).toEqual(['ham', 'olives']);
    });

    it('renders the custom listbox outside its trigger', async () => {
      await open('selects');
      expect(await page.locator('[data-g=colour-blue]').count()).toBe(0);
      await page.locator('[data-g=listbox-trigger]').click();
      const insideTrigger = await page.evaluate(() =>
        window.__gauntlet
          .find('listbox-trigger')
          .contains(window.__gauntlet.find('colour-blue')),
      );
      expect(insideTrigger).toBe(false);
      await page.locator('[data-g=colour-blue]').click();
      expect((await state()).colour).toBe('Blue');
      expect(await page.locator('[data-g=colour-blue]').count()).toBe(0);
    });

    it('loads combobox options after a delay', async () => {
      await open('selects');
      await page.locator('[data-g=combo]').pressSequentially('an');
      // Nothing yet: the server takes 300 ms.
      expect(await page.locator('#combo-list [role=option]').count()).toBe(0);
      await page.locator('[data-g=combo-option-mango]').click();
      expect((await state()).fruit).toBe('Mango');
    });
  });

  describe('overlays', () => {
    it.each([
      ['modal', 'backdrop'],
      ['banner', 'banner'],
      ['glass', 'glass'],
      ['toast', 'toast'],
    ])('%s: the target is covered by %s', async (which, cover) => {
      await open('overlays', `case=${which}`);
      await (await el('target')).scrollIntoViewIfNeeded();
      expect(await topElementAt('target')).toBe(cover);
    });

    it('glass: a click at the target lands on the invisible layer', async () => {
      await open('overlays', 'case=glass');
      const { x, y } = await centre('target');
      await page.mouse.click(x, y);
      expect(
        (await events()).filter((e) => e.type === 'click').map((e) => e.id),
      ).toEqual(['glass']);
      expect(await status()).toBe('');
    });

    it('modal and banner: dismissing the overlay frees the target', async () => {
      for (const [which, dismiss] of [
        ['modal', 'modal-close'],
        ['banner', 'banner-accept'],
      ]) {
        await open('overlays', `case=${which}`);
        await page.locator(`[data-g=${dismiss}]`).click();
        await (await el('target')).scrollIntoViewIfNeeded();
        expect(await topElementAt('target')).toBe('target');
        await context.close();
      }
    });

    it('sticky: scrolling the target to the top puts it under the header', async () => {
      await open('overlays', 'case=sticky');
      await page.evaluate(() =>
        window.__gauntlet.find('target').scrollIntoView({ block: 'start' }),
      );
      expect(await topElementAt('target')).toBe('sticky-header');
      await page.evaluate(() =>
        window.__gauntlet.find('target').scrollIntoView({ block: 'center' }),
      );
      expect(await topElementAt('target')).toBe('target');
    });

    it('toast: the cover leaves by itself after 1.5 s', async () => {
      await open('overlays', 'case=toast');
      expect(await topElementAt('target')).toBe('toast');
      await page.waitForTimeout(1_700);
      expect(await topElementAt('target')).toBe('target');
    });
  });

  describe('hover', () => {
    it('keeps the submenu out of reach until each parent is hovered', async () => {
      await open('hover');
      expect(await page.locator('[data-g=menu-download]').isVisible()).toBe(
        false,
      );
      await page.locator('[data-g=menu-products]').hover();
      expect(await page.locator('[data-g=menu-software]').isVisible()).toBe(
        true,
      );
      expect(await page.locator('[data-g=menu-download]').isVisible()).toBe(
        false,
      );
      await page.locator('[data-g=menu-software]').hover();
      await page.locator('[data-g=menu-download]').click();
      expect(await status()).toBe('Opened download');
    });

    it('names the icon buttons only while they are hovered', async () => {
      await open('hover');
      const button = page.locator('[data-g=icon-archive]');
      expect(await button.getAttribute('aria-describedby')).toBeNull();
      expect(await page.getByRole('tooltip').count()).toBe(0);
      await button.hover();
      expect(await page.getByRole('tooltip').textContent()).toBe('Archive');
    });
  });

  describe('drag and drop', () => {
    it('reorders the list with real pointer moves', async () => {
      await open('dnd');
      const from = await centre('item-echo');
      const to = await centre('item-alpha');
      await drag(from, { x: to.x, y: to.box.y + 4 });
      expect((await state()).order).toEqual([
        'Echo',
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
      ]);
    });

    it('moves a card between columns with native drag events', async () => {
      await open('dnd');
      await page
        .locator('[data-g=card-1]')
        .dragTo(page.locator('[data-g=card-3]'));
      expect((await state()).board).toEqual({
        todo: ['card-2'],
        done: ['card-3', 'card-1'],
      });
    });

    it('sets the slider by dragging its thumb', async () => {
      await open('dnd');
      const thumb = await centre('slider-thumb');
      const track = await page.locator('#track').boundingBox();
      if (!track) throw new Error('no track');
      await drag(thumb, { x: track.x + 73 * 3, y: thumb.y });
      expect((await state()).slider).toBe(73);
    });

    it('resizes the panel by dragging its handle', async () => {
      await open('dnd');
      const handle = await centre('resize-handle');
      const panel = await page.locator('#panel').boundingBox();
      if (!panel) throw new Error('no panel');
      await drag(handle, { x: panel.x + 400, y: handle.y });
      expect((await state()).panelWidth).toBe(400);
    });
  });

  describe('upload', () => {
    const fileAt = (name: string, text: string) => {
      const path = join(tmp, name);
      writeFileSync(path, text);
      return path;
    };

    it('takes a file on the plain input and reads its content', async () => {
      await open('upload');
      await page
        .locator('[data-g=plain]')
        .setInputFiles(fileAt('a.txt', 'alpha'));
      await expect
        .poll(async () => (await state()).uploads.plain)
        .toEqual([{ name: 'a.txt', size: 5, text: 'alpha' }]);
    });

    it('opens a file chooser from the styled button and from the drop zone', async () => {
      await open('upload');
      for (const [id, key] of [
        ['styled-button', 'styled'],
        ['zone', 'zone'],
      ]) {
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.locator(`[data-g=${id}]`).click(),
        ]);
        await chooser.setFiles(fileAt(`${key}.txt`, key));
        await expect
          .poll(async () => (await state()).uploads[key]?.[0]?.text)
          .toBe(key);
      }
    });

    it('rejects a file type the page does not allow', async () => {
      await open('upload');
      await page
        .locator('[data-g=images]')
        .setInputFiles([fileAt('ok.png', 'png'), fileAt('notes.txt', 'txt')]);
      await expect
        .poll(async () => (await state()).rejected.images)
        .toEqual(['notes.txt']);
      expect((await state()).uploads.images).toEqual([
        { name: 'ok.png', size: 3, text: 'png' },
      ]);
    });
  });

  describe('scroll', () => {
    it('is a 10,000 px document', async () => {
      await open('scroll');
      const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      expect(height).toBeGreaterThanOrEqual(10_000);
      await page.locator('[data-g=page-bottom]').click();
      expect(await status()).toBe('Reached the bottom');
    });

    it('loads the infinite list 20 items at a time', async () => {
      await open('scroll');
      expect(await page.locator('[data-g=item-200]').count()).toBe(0);
      const list = page.locator('#infinite');
      await expect
        .poll(
          async () => {
            await list.evaluate((n) => n.scrollTo(0, n.scrollHeight));
            return page.locator('[data-g=item-200]').count();
          },
          { timeout: 15_000 },
        )
        .toBe(1);
      await page.locator('[data-g=item-200]').click();
      expect(await status()).toBe('Opened Item 200');
    });

    it('only keeps the visible rows of the virtual list in the DOM', async () => {
      await open('scroll');
      expect(await page.locator('#virtual .row').count()).toBeLessThan(30);
      expect(await page.locator('[data-g=row-4321]').count()).toBe(0);

      await page.locator('#virtual').evaluate((n) => n.scrollTo(0, 4320 * 30));
      await page.locator('[data-g=row-4321]').click();
      expect(await status()).toBe('Opened row 4321');
      expect(await page.locator('[data-g=row-1]').count()).toBe(0);
    });

    it('scrolls the inner area without moving the outer one', async () => {
      await open('scroll');
      await page.locator('#outer').scrollIntoViewIfNeeded();
      await page
        .locator('#inner')
        .evaluate((n) => n.scrollTo(0, n.scrollHeight));
      expect(await page.locator('#outer').evaluate((n) => n.scrollTop)).toBe(0);
      await page.locator('[data-g=inner-action]').click();
      expect(await status()).toBe('Inner action done');
    });

    it('hides the export button 39 columns to the right', async () => {
      await open('scroll');
      const before = await page.locator('#wide').evaluate((n) => n.scrollLeft);
      await page.locator('[data-g=wide-action]').click();
      const after = await page.locator('#wide').evaluate((n) => n.scrollLeft);
      expect(before).toBe(0);
      expect(after).toBeGreaterThan(3_000);
      expect(await status()).toBe('Exported');
    });
  });

  describe('tabs', () => {
    it.each([
      ['blank-link', 'link'],
      ['open-button', 'button'],
    ])('%s opens a second tab that can be acted in', async (id, from) => {
      await open('tabs');
      const [child] = await Promise.all([
        context.waitForEvent('page'),
        page.locator(`[data-g=${id}]`).click(),
      ]);
      await child.waitForLoadState();
      expect(context.pages()).toHaveLength(2);
      await child.locator('[data-g=child-confirm]').click();
      await expect
        .poll(async () => (await state()).childMessages)
        .toEqual([`confirmed from ${from}`]);
    });

    it('opens a window that closes itself', async () => {
      await open('tabs');
      const [child] = await Promise.all([
        context.waitForEvent('page'),
        page.locator('[data-g=closing-button]').click(),
      ]);
      await child.waitForEvent('close');
      expect(context.pages()).toHaveLength(1);
      expect((await state()).childMessages).toEqual(['print window closed']);
    });
  });

  describe('dialogs', () => {
    it('blocks the page until each dialog is answered', async () => {
      await open('dialogs');
      const seen: string[] = [];
      page.on('dialog', async (dialog) => {
        seen.push(`${dialog.type()}: ${dialog.message()}`);
        if (dialog.type() === 'prompt') await dialog.accept('Gemini');
        else if (dialog.type() === 'confirm') await dialog.dismiss();
        else await dialog.accept();
      });

      await page.locator('[data-g=alert]').click();
      await page.locator('[data-g=confirm]').click();
      expect(await status()).toBe('Deletion cancelled');
      await page.locator('[data-g=prompt]').click();
      expect(await status()).toBe('Renamed to Gemini');

      expect(seen).toEqual([
        'alert: Maintenance tonight at 22:00',
        'confirm: Delete project "Apollo"? This cannot be undone.',
        'prompt: New project name',
      ]);
      expect(
        (await events())
          .filter((e) => e.type === 'dialog')
          .map((e) => e.detail),
      ).toEqual(['closed', false, 'Gemini']);
    });

    it('raises one dialog half a second after the click that caused it', async () => {
      await open('dialogs');
      let raisedAfter = -1;
      const clicked = Date.now();
      const dialog = page.waitForEvent('dialog');
      await page.locator('[data-g=late]').click();
      expect(await status()).toBe('Saving…');
      const d = await dialog;
      raisedAfter = Date.now() - clicked;
      await d.accept();
      expect(raisedAfter).toBeGreaterThanOrEqual(450);
      await expect.poll(status).toBe('Saved with warnings');
    });

    it('asks before leaving when there are unsaved changes', async () => {
      await open('dialogs');
      await page.locator('[data-g=guard]').check();
      const dialog = page.waitForEvent('dialog');
      const click = page.locator('[data-g=leave]').click();
      const d = await dialog;
      expect(d.type()).toBe('beforeunload');
      await d.accept();
      await click;
      await page.waitForURL(/left=1/);
      expect((await state()).left).toBe(true);
    });
  });

  describe('duplicates', () => {
    it('removes exactly the row whose button was clicked', async () => {
      await open('dupes');
      expect(await page.getByRole('button', { name: 'Delete' }).count()).toBe(
        5,
      );
      await (await el('delete-3')).click();
      expect((await state()).rows).toEqual([1, 2, 4, 5]);
      expect(await status()).toBe('Deleted INV-003');
    });

    it('has two forms whose fields and buttons share their names', async () => {
      await open('dupes');
      expect(await page.getByLabel('Email').count()).toBe(2);
      expect(await page.getByRole('button', { name: 'Continue' }).count()).toBe(
        2,
      );
      await page.locator('[data-g=register-email]').fill('new@example.com');
      await page.locator('[data-g=register-submit]').click();
      const [submit] = (await events()).filter((e) => e.type === 'submit');
      expect(submit).toMatchObject({
        id: 'register',
        detail: { email: 'new@example.com' },
      });
    });
  });

  describe('dynamic', () => {
    it('replaces every list node on each keystroke', async () => {
      await open('dynamic');
      const before = await el('contact-ada');
      await page.locator('[data-g=filter]').pressSequentially('a');
      expect(await before.evaluate((n) => n.isConnected)).toBe(false);
      // An equivalent node exists again, under the same id.
      const after = await el('contact-ada');
      expect(await after.getAttribute('data-generation')).toBe('2');
    });

    it('rebuilds the list about 25 times a second while churning', async () => {
      await open('dynamic');
      await page.locator('[data-g=churn]').click();
      await page.waitForTimeout(1_000);
      const { generation, churning } = await state();
      expect(churning).toBe(true);
      expect(generation).toBeGreaterThan(15);
    });

    it('swaps the button for a new node on every click', async () => {
      await open('dynamic');
      const first = await el('swap');
      await first.click();
      expect(await first.evaluate((n) => n.isConnected)).toBe(false);
      await (await el('swap')).click();
      expect((await state()).likes).toBe(2);
    });

    it('adds a control two seconds after load', async () => {
      await open('dynamic');
      expect(await page.locator('[data-g=late-action]').count()).toBe(0);
      await page.locator('[data-g=late-action]').click();
      expect(await status()).toBe('Invoice downloaded');
    });

    it('has a button that travels for 1.5 s before it can be trusted', async () => {
      await open('dynamic');
      const start = (await centre('runner')).x;
      await page.waitForTimeout(400);
      expect((await centre('runner')).x).toBeGreaterThan(start + 40);
      await page.locator('[data-g=runner]').click();
      const [caught] = (await events()).filter((e) => e.type === 'caught');
      // Playwright waits for the element to stop before clicking.
      expect(caught.detail).toBe(true);
    });
  });

  describe('editors', () => {
    it('takes text in a contenteditable', async () => {
      await open('editor');
      await page.locator('[data-g=rich]').click();
      await page.keyboard.type('Hello\nworld');
      expect((await state()).rich).toBe('Hello\nworld');
    });

    it('types into an invisible textarea laid over the rendered code', async () => {
      await open('editor');
      const opacity = await page
        .locator('[data-g=code]')
        .evaluate((n) => getComputedStyle(n).opacity);
      expect(opacity).toBe('0');
      await page.locator('[data-g=code]').fill('const x = 1;');
      expect(await page.locator('#code-view').textContent()).toBe(
        'const x = 1;',
      );
    });

    it('draws its button on a canvas, with a DOM fallback that has no box', async () => {
      await open('editor');
      expect(await (await el('canvas-reset')).boundingBox()).toBeNull();

      const canvas = await page.locator('#canvas').boundingBox();
      if (!canvas) throw new Error('no canvas');
      await page.mouse.click(canvas.x + 360, canvas.y + 25);
      await page.mouse.click(canvas.x + 50, canvas.y + 80);
      expect((await events()).filter((e) => e.type === 'reset')).toEqual([
        expect.objectContaining({ detail: 'pointer' }),
      ]);
    });
  });

  describe('huge', () => {
    it('has 2,000 controls and 20,000 text spans', async () => {
      await open('huge');
      expect(await page.locator('.record span').count()).toBe(20_000);
      await page.locator('[data-g=archive-377]').click();
      expect(await status()).toBe('Archived record 377');
    });
  });

  describe('states', () => {
    it('enables the submit button only for a valid form', async () => {
      await open('states');
      const submit = page.locator('[data-g=submit]');
      expect(await submit.isDisabled()).toBe(true);
      await page.locator('[data-g=email]').fill('me@work.io');
      expect(await submit.isDisabled()).toBe(true);
      await page.locator('[data-g=agree]').check();
      expect(await submit.isDisabled()).toBe(false);
      await submit.click();
      expect(await status()).toBe('Subscribed');
    });

    it('lets a click through to an aria-disabled button, which ignores it', async () => {
      await open('states');
      // Playwright's own click() treats aria-disabled as disabled and waits
      // for ever; a pointer does not know about ARIA.
      const { x, y } = await centre('aria-disabled');
      await page.mouse.click(x, y);
      expect((await events()).filter((e) => e.type === 'ignored')).toHaveLength(
        1,
      );
      expect(await status()).toBe('');
    });

    it.each([
      ['no-pointer', 'ignores the pointer'],
      ['transparent', 'is fully transparent'],
    ])('%s is laid out but %s', async (id) => {
      await open('states');
      expect(await (await el(id)).boundingBox()).not.toBeNull();
      expect(await page.locator(`[data-g=${id}]`).isVisible()).toBe(true);
      if (id === 'no-pointer') expect(await topElementAt(id)).not.toBe(id);
    });

    it.each(['zero-size', 'invisible', 'not-rendered'])(
      '%s cannot be seen',
      async (id) => {
        await open('states');
        expect(await page.locator(`[data-g=${id}]`).isVisible()).toBe(false);
      },
    );

    it('disables a button through its fieldset', async () => {
      await open('states');
      const button = page.locator('[data-g=in-disabled-fieldset]');
      expect(await button.getAttribute('disabled')).toBeNull();
      expect(await button.isDisabled()).toBe(true);
    });
  });

  describe('spa', () => {
    it('changes route without reloading the document', async () => {
      await open('spa');
      const { bootId } = await state();
      await page.locator('[data-g=nav-profile]').click();
      expect(page.url()).toBe(`${gauntlet.baseUrl}/spa/profile`);
      expect((await state()).bootId).toBe(bootId);

      await page.goBack();
      expect((await state()).route).toBe('home');
      expect((await state()).bootId).toBe(bootId);

      await page.reload();
      expect((await state()).bootId).not.toBe(bootId);
    });

    it('shows a slow route as loading for 1.5 s', async () => {
      await open('spa');
      await page.locator('[data-g=nav-slow]').click();
      expect(await page.locator('#slow-status').textContent()).toBe(
        'Loading report…',
      );
      await page.locator('[data-g=slow-download]').waitFor();
      expect(await page.locator('#slow-status').textContent()).toBe(
        'Report ready',
      );
    });

    it('never goes network-idle on the live route', async () => {
      await open('spa');
      await page.locator('[data-g=nav-live]').click();
      await expect(
        page.waitForLoadState('networkidle', { timeout: 1_500 }),
      ).rejects.toThrow(/Timeout/);
      expect((await state()).ticks).toBeGreaterThan(3);
      // And it is perfectly usable all the same.
      await page.locator('[data-g=live-pause]').click();
      expect((await events()).some((e) => e.type === 'paused')).toBe(true);
    });

    it('streams a response for three seconds', async () => {
      await open('spa');
      await page.locator('[data-g=nav-stream]').click();
      await page.waitForTimeout(1_200);
      const partial = await page.locator('#log').textContent();
      expect(partial).toContain('chunk 2');
      expect(partial).not.toContain('chunk 6');
      await expect
        .poll(async () => (await events()).some((e) => e.type === 'complete'), {
          timeout: 5_000,
        })
        .toBe(true);
    });
  });
});
