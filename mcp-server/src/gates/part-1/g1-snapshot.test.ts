// G1 — the snapshot tells the truth (R-A1 … R-A13).
import { describe, expect } from 'vitest';
import { GAUNTLET_PAGES } from '../../test-support/gauntlet/server.js';
import {
  REF_IN_TEXT,
  SNAPSHOT_CHAR_BUDGET,
  type SnapshotElement,
} from './contract.js';
import { type Session, gate, useGauntlet } from './harness.js';

const tally = (ids: string[]) => {
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
};

// Every data-g in every frame of the page, straight from the DOM.
async function registryOfAllFrames(s: Session): Promise<string[]> {
  const all: string[] = [];
  for (const frame of s.page.frames()) {
    all.push(
      ...(await frame
        .evaluate(() => window.__gauntlet?.ids() ?? [])
        .catch(() => [])),
    );
  }
  return all;
}

const g = (e: SnapshotElement) => e.attributes?.['data-g'];

describe('G1 snapshot truth', () => {
  const ctx = useGauntlet();

  describe('G1.1 every actionable element, exactly once', () => {
    for (const name of GAUNTLET_PAGES) {
      gate(
        'G1.1',
        'R-A1 R-A2 R-A13',
        `${name}: references match the page's own registry, exhaustively`,
        async () => {
          const s = await ctx.open(name);
          // Late frames (1 s) and late content (2 s) are part of the page.
          await s.page.waitForTimeout(name === 'dynamic' ? 2_300 : 1_300);

          const { elements } = await s.snapshot();
          const reported = elements.map(g);

          // No reference to something the page does not consider actionable.
          expect(reported.filter((id) => id === undefined)).toEqual([]);
          // And every actionable element referenced exactly once.
          expect(tally(reported as string[])).toEqual(
            tally(await registryOfAllFrames(s)),
          );
          expect(new Set(elements.map((e) => e.ref)).size).toBe(
            elements.length,
          );
          for (const e of elements) expect(e.ref).toMatch(/^e\d+$/);
        },
      );
    }
  });

  describe('G1.2 shadow roots and frames', () => {
    gate(
      'G1.2',
      'R-A3',
      'elements in open and closed shadow roots are referenced, with their container',
      async () => {
        const s = await ctx.open('shadow');
        const { containers = [] } = await s.snapshot();
        const kindOf = (id: string) => containers.find((c) => c.id === id);

        const closed = await s.element('closed-save');
        expect(closed.path).toHaveLength(1);
        expect(kindOf(closed.path[0])).toMatchObject({
          kind: 'shadow',
          mode: 'closed',
        });

        const deep = await s.element('deep-button');
        expect(deep.path.map((id) => kindOf(id)?.mode)).toEqual([
          'open',
          'closed',
          'open',
        ]);
      },
    );

    gate(
      'G1.2',
      'R-A3',
      'elements in same-origin, cross-origin, nested and late frames are referenced',
      async () => {
        const s = await ctx.open('frames');
        await s.page.waitForTimeout(1_300);
        const { elements, containers = [] } = await s.snapshot();

        const comments = elements.filter((e) => g(e) === 'comment');
        expect(comments).toHaveLength(4);
        // One of them is two frames deep.
        expect(comments.map((e) => e.path.length).sort()).toEqual([1, 1, 1, 2]);

        const frames = containers.filter((c) => c.kind === 'frame');
        expect(frames).toHaveLength(5);
        expect(
          frames.filter((f) => f.url?.startsWith(ctx.gauntlet.otherUrl)),
        ).toHaveLength(1);
        expect(frames.some((f) => f.url?.includes('name=late'))).toBe(true);
      },
    );

    gate(
      'G1.2',
      'R-A3',
      'a frame that has not loaded yet is simply absent, then appears',
      async () => {
        // Since part 2, opening a page audits each of its frames: on a slow
        // runner that took longer than the one second the late frame used to
        // wait, and the first snapshot already had it. It now comes eight
        // seconds after load, and the test waits for it rather than for a
        // fixed time.
        const s = await ctx.open('frames', 'late=8000');
        const early = (await s.snapshot()).elements.filter(
          (e) => g(e) === 'comment',
        );
        expect(early).toHaveLength(3);
        // Its comment field, not its readyState: a new frame is a complete
        // about:blank before it navigates.
        await s.page.waitForFunction(
          () =>
            (
              document.querySelector(
                'iframe[data-frame="late"]',
              ) as HTMLIFrameElement | null
            )?.contentDocument?.querySelector('[data-g="comment"]') != null,
          undefined,
          { timeout: 20_000 },
        );
        const late = (await s.snapshot()).elements.filter(
          (e) => g(e) === 'comment',
        );
        expect(late).toHaveLength(4);
      },
    );
  });

  describe('G1.3 what each element line says', () => {
    const EXPECTED: Array<
      [
        page:
          | 'forms'
          | 'states'
          | 'selects'
          | 'dupes'
          | 'editor'
          | 'hover'
          | 'dnd',
        g: string,
        fields: Partial<SnapshotElement>,
      ]
    > = [
      [
        'forms',
        'text',
        { role: 'textbox', name: 'Full name', required: true, tag: 'input' },
      ],
      [
        'forms',
        'email',
        {
          role: 'textbox',
          name: 'Email address',
          required: true,
          input_type: 'email',
        },
      ],
      [
        'forms',
        'number',
        { role: 'spinbutton', name: 'Quantity', input_type: 'number' },
      ],
      [
        'forms',
        'search',
        { role: 'searchbox', placeholder: 'Search products' },
      ],
      ['forms', 'unlabelled', { role: 'textbox', name: '' }],
      ['forms', 'password', { name: 'Password', input_type: 'password' }],
      ['forms', 'tel', { name: 'Phone', input_type: 'tel' }],
      ['forms', 'url', { name: 'Website', input_type: 'url' }],
      ['forms', 'date', { name: 'Birthday', input_type: 'date' }],
      ['forms', 'time', { name: 'Alarm', input_type: 'time' }],
      [
        'forms',
        'datetime',
        { name: 'Appointment', input_type: 'datetime-local' },
      ],
      ['forms', 'month', { name: 'Billing month', input_type: 'month' }],
      ['forms', 'week', { name: 'Sprint week', input_type: 'week' }],
      [
        'forms',
        'color',
        { name: 'Accent colour', input_type: 'color', value: '#000000' },
      ],
      ['forms', 'range', { role: 'slider', name: 'Volume', value: '50' }],
      ['forms', 'textarea', { role: 'textbox', name: 'Bio', tag: 'textarea' }],
      [
        'forms',
        'terms',
        { role: 'checkbox', name: 'I accept the terms', checked: false },
      ],
      ['forms', 'plan-pro', { role: 'radio', name: 'Pro', checked: false }],
      [
        'forms',
        'switch',
        { role: 'switch', name: 'Email notifications', checked: false },
      ],
      [
        'forms',
        'masked',
        { name: 'Mobile (masked)', placeholder: '(555) 555-5555' },
      ],
      ['forms', 'coupon', { name: 'Coupon', invalid: true, value: 'EXPIRED' }],
      [
        'forms',
        'readonly',
        { name: 'Account id', readonly: true, value: 'ACC-0042' },
      ],
      ['forms', 'disabled-input', { name: 'Legacy code', disabled: true }],
      [
        'forms',
        'submit',
        { role: 'button', name: 'Create account', tag: 'button' },
      ],
      [
        'states',
        'submit',
        { role: 'button', name: 'Subscribe', disabled: true },
      ],
      ['states', 'aria-disabled', { name: 'Upgrade plan', disabled: true }],
      [
        'states',
        'in-disabled-fieldset',
        { name: 'Change card', disabled: true },
      ],
      ['states', 'invisible', { name: 'Restore backup', hidden: 'visibility' }],
      ['states', 'not-rendered', { hidden: 'display' }],
      ['states', 'zero-size', { hidden: 'zero_size' }],
      [
        'selects',
        'native-single',
        { role: 'combobox', name: 'Fruit', tag: 'select' },
      ],
      ['selects', 'native-multiple', { role: 'listbox', name: 'Toppings' }],
      ['selects', 'listbox-trigger', { role: 'button', expanded: false }],
      [
        'selects',
        'combo',
        { role: 'combobox', name: 'Favourite fruit', expanded: false },
      ],
      ['dupes', 'delete-3', { role: 'button', name: 'Delete' }],
      ['dupes', 'more-security', { role: 'link', name: 'Read more' }],
      [
        'dupes',
        'register-password',
        { name: 'Password', input_type: 'password' },
      ],
      ['editor', 'bold', { role: 'button', name: 'Bold', pressed: false }],
      ['editor', 'rich', { role: 'textbox', name: 'Message' }],
      ['hover', 'menu-products', { role: 'menuitem' }],
      ['dnd', 'slider-thumb', { role: 'slider', name: 'Opacity', value: '20' }],
    ];

    const pages = [...new Set(EXPECTED.map(([page]) => page))];
    for (const name of pages) {
      gate(
        'G1.3',
        'R-A4',
        `${name}: role, name, value and state of each element`,
        async () => {
          const s = await ctx.open(name);
          const { elements } = await s.snapshot();
          for (const [, id, fields] of EXPECTED.filter(
            ([page]) => page === name,
          )) {
            const element = elements.find((e) => g(e) === id);
            expect(element, id).toMatchObject(fields);
          }
        },
      );
    }

    gate('G1.3', 'R-A4', 'a link reports where it goes', async () => {
      const s = await ctx.open('dupes');
      expect((await s.element('more-security')).href).toMatch(/#security$/);
    });

    gate(
      'G1.3',
      'R-A4 R-E2',
      'a password is reported as filled, never as its value',
      async () => {
        const s = await ctx.open('forms');
        // Filled behind the tools: this suite is about what the snapshot says.
        await s.page.locator('[data-g=password]').fill('hunter2-secret');
        expect((await s.element('password')).value).toBe('(filled)');
        const text = (await s.capture({ format: 'text' })).text;
        expect(text).not.toContain('hunter2-secret');
        expect(JSON.stringify(await s.snapshot())).not.toContain(
          'hunter2-secret',
        );
      },
    );

    gate(
      'G1.3',
      'R-A4',
      'state changes show up: checked, expanded, value',
      async () => {
        const s = await ctx.open('forms');
        await s.page.locator('[data-g=terms]').check();
        await s.page.locator('[data-g=text]').fill('Ada');
        expect(await s.element('terms')).toMatchObject({ checked: true });
        expect(await s.element('text')).toMatchObject({ value: 'Ada' });
      },
    );
  });

  describe('G1.4 visibility is stated', () => {
    for (const [which, cover] of [
      ['modal', 'backdrop'],
      ['banner', 'banner'],
      ['glass', 'glass'],
      ['toast', 'toast'],
    ] as const) {
      gate(
        'G1.4',
        'R-A5',
        `${which}: the target is marked covered by the right element`,
        async () => {
          const s = await ctx.open('overlays', `case=${which}`);
          await s.page.evaluate(() =>
            window.__gauntlet
              .find('target')
              .scrollIntoView({ block: 'center' }),
          );
          const target = await s.element('target');
          expect(target.covered_by).toBe(await s.ref(cover));
          // Still listed: being covered does not make it disappear.
          expect(target.hidden).toBeUndefined();
        },
      );
    }

    gate('G1.4', 'R-A5', 'the mark goes when the overlay goes', async () => {
      const s = await ctx.open('overlays', 'case=modal');
      expect((await s.element('target')).covered_by).toBeDefined();
      await s.page.locator('[data-g=modal-close]').click();
      expect((await s.element('target')).covered_by).toBeUndefined();

      const toast = await ctx.open('overlays', 'case=toast');
      await toast.page.waitForTimeout(1_700);
      expect((await toast.element('target')).covered_by).toBeUndefined();
    });

    gate(
      'G1.4',
      'R-A5',
      'sticky: covered only while it sits under the header',
      async () => {
        const s = await ctx.open('overlays', 'case=sticky');
        await s.page.evaluate(() =>
          window.__gauntlet.find('target').scrollIntoView({ block: 'start' }),
        );
        expect((await s.element('target')).covered_by).toBe(
          await s.ref('sticky-header'),
        );
        await s.page.evaluate(() =>
          window.__gauntlet.find('target').scrollIntoView({ block: 'center' }),
        );
        expect((await s.element('target')).covered_by).toBeUndefined();
      },
    );

    gate(
      'G1.4',
      'R-A5',
      'an element outside the viewport is marked offscreen until scrolled to',
      async () => {
        const s = await ctx.open('scroll');
        expect((await s.element('page-bottom')).offscreen).toBe(true);
        expect((await s.element('infinite')).offscreen).toBeFalsy();
        await s.page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        expect((await s.element('page-bottom')).offscreen).toBeFalsy();
        expect((await s.element('infinite')).offscreen).toBe(true);
      },
    );

    gate(
      'G1.4',
      'R-A5',
      'an element scrolled out of its container is offscreen even inside the viewport',
      async () => {
        const s = await ctx.open('scroll');
        await s.page.locator('#outer').scrollIntoViewIfNeeded();
        expect((await s.element('inner-action')).offscreen).toBe(true);
        await s.page
          .locator('#inner')
          .evaluate((n) => n.scrollTo(0, n.scrollHeight));
        expect((await s.element('inner-action')).offscreen).toBeFalsy();
      },
    );

    gate(
      'G1.4',
      'R-A5',
      'a pointer-events: none button is marked as ignoring the pointer, a transparent one is not hidden',
      async () => {
        const s = await ctx.open('states');
        expect((await s.element('transparent')).hidden).toBeUndefined();
        // Listed and laid out, but a click there goes to something else.
        const noPointer = await s.element('no-pointer');
        expect(noPointer.hidden).toBeUndefined();
        expect(noPointer.unclickable).toBe('pointer_events');
      },
    );
  });

  describe('G1.5 scroll position', () => {
    gate(
      'G1.5',
      'R-A6',
      'page scroll figures match the DOM to the pixel',
      async () => {
        const s = await ctx.open('scroll');
        const truth = () =>
          s.page.evaluate(() => ({
            y: Math.round(scrollY),
            max_y: document.documentElement.scrollHeight - innerHeight,
          }));

        expect((await s.snapshot()).scroll).toMatchObject({
          x: 0,
          ...(await truth()),
        });
        await s.page.evaluate(() => window.scrollTo(0, 1234));
        expect((await truth()).y).toBe(1234);
        expect((await s.snapshot()).scroll).toMatchObject(await truth());
        await s.page.evaluate(() => window.scrollTo(0, 1e9));
        const bottom = (await s.snapshot()).scroll;
        expect(bottom.y).toBe(bottom.max_y);
      },
    );

    gate(
      'G1.5',
      'R-A6',
      'each scroll container reports its own figures',
      async () => {
        const s = await ctx.open('scroll');
        for (const id of ['infinite', 'wide', 'outer', 'inner', 'virtual']) {
          const truth = await s.dom<{
            y: number;
            max_y: number;
            x: number;
            max_x: number;
          }>(
            id,
            '({ y: el.scrollTop, max_y: el.scrollHeight - el.clientHeight, x: el.scrollLeft, max_x: el.scrollWidth - el.clientWidth })',
          );
          expect((await s.element(id)).scroll, id).toEqual(truth);
        }
        await s.page.locator('#inner').evaluate((n) => n.scrollTo(0, 77));
        expect((await s.element('inner')).scroll?.y).toBe(77);
        expect((await s.element('outer')).scroll?.y).toBe(0);
        expect((await s.element('virtual')).scroll?.max_y).toBe(
          5000 * 30 - 300,
        );
      },
    );

    gate(
      'G1.5',
      'R-A6',
      'the text format states the distances in pixels',
      async () => {
        const s = await ctx.open('scroll');
        await s.page.evaluate(() => window.scrollTo(0, 1234));
        const { text, scroll } = await s.capture({ format: 'text' });
        expect(text).toContain('1,234 px above');
        expect(text).toContain(
          `${(scroll.max_y - 1234).toLocaleString('en-US')} px below`,
        );
      },
    );
  });

  describe('G1.6 stable references', () => {
    gate(
      'G1.6',
      'R-A8',
      'an unchanged page gives the same references 20 times',
      async () => {
        const s = await ctx.open('forms');
        const first = Object.fromEntries(
          (await s.snapshot()).elements.map((e) => [g(e), e.ref]),
        );
        for (let i = 0; i < 20; i++) {
          const again = Object.fromEntries(
            (await s.snapshot()).elements.map((e) => [g(e), e.ref]),
          );
          expect(again).toEqual(first);
        }
      },
    );

    gate(
      'G1.6',
      'R-A8',
      'references survive scrolling and unrelated changes',
      async () => {
        const s = await ctx.open('dupes');
        const before = await s.ref('delete-5');
        await s.page.locator('[data-g=delete-2]').click();
        await s.page.evaluate(() => window.scrollTo(0, 400));
        expect(await s.ref('delete-5')).toBe(before);
      },
    );

    gate(
      'G1.6',
      'R-A8',
      'a re-created node gets a new reference and old ones are never reused',
      async () => {
        const s = await ctx.open('dynamic');
        const everIssued = new Set<string>();
        let previous = (await s.snapshot()).elements;
        for (const e of previous) everIssued.add(e.ref);

        for (const key of ['a', 'd', 'Backspace', 'Backspace', 'e']) {
          await s.page.locator('[data-g=filter]').press(key);
          const current = (await s.snapshot()).elements;
          const contacts = current.filter((e) => g(e)?.startsWith('contact-'));
          expect(contacts.length).toBeGreaterThan(0);
          for (const contact of contacts) {
            // Rebuilt node: a reference nobody has seen before.
            expect(everIssued.has(contact.ref), contact.ref).toBe(false);
          }
          // The filter input was not rebuilt: same reference as before.
          expect(current.find((e) => g(e) === 'filter')?.ref).toBe(
            previous.find((e) => g(e) === 'filter')?.ref,
          );
          for (const e of current) everIssued.add(e.ref);
          previous = current;
        }
      },
    );

    gate(
      'G1.6',
      'R-A8',
      'an identical replacement is still a different element',
      async () => {
        const s = await ctx.open('dynamic');
        const before = await s.ref('swap');
        await s.page.locator('[data-g=swap]').click();
        expect(await s.ref('swap')).not.toBe(before);
      },
    );
  });

  describe('G1.7 what changed', () => {
    gate(
      'G1.7',
      'R-A9',
      'an element that appeared is marked new once',
      async () => {
        const s = await ctx.open('dynamic');
        await s.snapshot();
        await s.page.waitForTimeout(2_300);
        const second = (await s.snapshot()).elements;
        expect(second.filter((e) => e.is_new).map(g)).toEqual(['late-action']);
        const third = (await s.snapshot()).elements;
        expect(third.filter((e) => e.is_new)).toEqual([]);
      },
    );

    gate(
      'G1.7',
      'R-A9',
      'the diff lists exactly what was removed',
      async () => {
        const s = await ctx.open('dupes');
        const doomed = await s.ref('delete-3');
        await s.page.locator('[data-g=delete-3]').click();
        const { diff } = await s.capture({ format: 'json', diff: true });
        expect(diff).toEqual({ added: [], removed: [doomed], changed: [] });
      },
    );

    gate(
      'G1.7',
      'R-A9',
      'the diff lists exactly what was added and what changed',
      async () => {
        const s = await ctx.open('selects');
        await s.snapshot();
        await s.page.locator('[data-g=listbox-trigger]').click();
        const { diff } = await s.capture({
          format: 'json',
          diff: true,
          include_attributes: ['data-g'],
        });
        expect(diff?.added.map(g).sort()).toEqual([
          'colour-blue',
          'colour-green',
          'colour-purple',
          'colour-red',
          'colour-yellow',
        ]);
        expect(diff?.removed).toEqual([]);
        expect(diff?.changed.map(g)).toEqual(['listbox-trigger']);
        expect(diff?.changed[0]).toMatchObject({ expanded: true });
      },
    );

    gate('G1.7', 'R-A9', 'no change, empty diff', async () => {
      const s = await ctx.open('forms');
      await s.snapshot();
      const { diff } = await s.capture({ format: 'json', diff: true });
      expect(diff).toEqual({ added: [], removed: [], changed: [] });
    });

    gate(
      'G1.7',
      'R-A7',
      'open tabs are listed and the active one is marked',
      async () => {
        const s = await ctx.open('tabs');
        expect((await s.snapshot()).tabs).toEqual([
          expect.objectContaining({
            index: 0,
            active: true,
            title: 'Gauntlet — tabs',
          }),
        ]);
        await s.page.locator('[data-g=open-button]').click();
        await expect.poll(async () => (await s.snapshot()).tabs.length).toBe(2);
        const { tabs } = await s.snapshot();
        expect(tabs[1]).toMatchObject({
          index: 1,
          title: 'Gauntlet — child tab',
        });
        expect(tabs.filter((t) => t.active)).toHaveLength(1);
      },
    );

    gate(
      'G1.7',
      'R-A7',
      'an open dialog is stated with its type and message',
      async () => {
        const s = await ctx.open('dialogs');
        expect((await s.snapshot()).dialog).toBeUndefined();
        // Fired from a timer so that this call returns while the dialog is up.
        await s.page.evaluate(() => {
          setTimeout(() => window.__gauntlet.find('confirm').click(), 0);
        });
        await expect
          .poll(async () => (await s.snapshot()).dialog)
          .toEqual({
            type: 'confirm',
            message: 'Delete project "Apollo"? This cannot be undone.',
          });
      },
    );
  });

  describe('G1.8 size, scope and text', () => {
    gate(
      'G1.8',
      'R-A10',
      'a huge page is cut at an element boundary, says what is left, and pages through everything once',
      async () => {
        const s = await ctx.open('huge');
        const all = (await s.snapshot()).elements.map((e) => e.ref);
        expect(all).toHaveLength(2000);

        const first = await s.capture({
          format: 'text',
          actionable_only: true,
        });
        expect(first.text.length).toBeLessThanOrEqual(SNAPSHOT_CHAR_BUDGET);
        expect(first.truncated).toMatchObject({ page: 1 });
        const pages = first.truncated?.pages ?? 0;
        expect(pages).toBeGreaterThan(1);

        const seen: string[] = [];
        let remaining = Number.POSITIVE_INFINITY;
        for (let page = 1; page <= pages; page++) {
          const snap =
            page === 1
              ? first
              : await s.capture({
                  format: 'text',
                  actionable_only: true,
                  page,
                });
          expect(snap.text.length).toBeLessThanOrEqual(SNAPSHOT_CHAR_BUDGET);
          const refs = [...snap.text.matchAll(REF_IN_TEXT)].map((m) => m[1]);
          seen.push(...refs);

          // Never cut in the middle of an element: every line that starts an
          // element has its closing reference.
          for (const line of snap.text.split('\n')) {
            if (/^\s*- /.test(line)) expect(line).toMatch(/\[e\d+\]/);
          }
          if (page < pages) {
            expect(snap.truncated?.elements_remaining).toBeLessThan(remaining);
            remaining = snap.truncated?.elements_remaining ?? 0;
            expect(snap.text).toContain(
              `${remaining.toLocaleString('en-US')} more elements`,
            );
          } else {
            expect(snap.truncated?.elements_remaining).toBe(0);
          }
        }
        expect(seen.sort()).toEqual([...all].sort());
      },
    );

    gate(
      'G1.8',
      'R-A10',
      'a small page is one page with no truncation notice',
      async () => {
        const s = await ctx.open('dupes');
        const snap = await s.capture({ format: 'text' });
        expect(snap.truncated).toBeUndefined();
        expect(snap.text).not.toContain('more elements');
      },
    );

    gate(
      'G1.8',
      'R-A11',
      'a snapshot can be limited to one element’s subtree',
      async () => {
        const s = await ctx.open('scroll');
        const { elements } = await s.snapshot({ within: await s.ref('inner') });
        expect(elements.map(g).sort()).toEqual(['inner', 'inner-action']);
      },
    );

    gate(
      'G1.8',
      'R-A11',
      'actionable-only drops the surrounding text',
      async () => {
        const s = await ctx.open('dupes');
        const full = (await s.capture({ format: 'text' })).text;
        const lean = (
          await s.capture({ format: 'text', actionable_only: true })
        ).text;
        expect(full).toContain('INV-003');
        expect(lean).not.toContain('INV-003');
        expect([...lean.matchAll(REF_IN_TEXT)]).toHaveLength(
          [...full.matchAll(REF_IN_TEXT)].length,
        );
      },
    );

    gate(
      'G1.8',
      'R-A12',
      'text content is present, in reading order',
      async () => {
        const s = await ctx.open('forms');
        const { text } = await s.capture({ format: 'text' });
        const order = [
          'Labels',
          'Every type',
          'Inputs that listen to keys',
          'States',
        ].map((heading) => text.indexOf(heading));
        expect(order.every((i) => i >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);

        const table = (
          await (await ctx.open('dupes')).capture({ format: 'text' })
        ).text;
        expect(table).toContain('455 €');
        expect(table.indexOf('INV-002')).toBeLessThan(table.indexOf('INV-003'));
      },
    );

    gate(
      'G1.8',
      'R-A12',
      'a status message written by the page is readable in the snapshot',
      async () => {
        const s = await ctx.open('dupes');
        await s.page.locator('[data-g=delete-4]').click();
        expect((await s.capture({ format: 'text' })).text).toContain(
          'Deleted INV-004',
        );
      },
    );

    gate(
      'G1.8',
      'R-A13',
      'attributes are reported only when asked for',
      async () => {
        const s = await ctx.open('dupes');
        const bare = await s.capture({ format: 'json' });
        expect(bare.elements?.every((e) => e.attributes === undefined)).toBe(
          true,
        );
        const withId = await s.capture({
          format: 'json',
          include_attributes: ['data-g', 'type'],
        });
        const submit = withId.elements?.find(
          (e) => e.attributes?.['data-g'] === 'login-submit',
        );
        expect(submit?.attributes).toEqual({
          'data-g': 'login-submit',
          type: 'submit',
        });
      },
    );
  });
});
