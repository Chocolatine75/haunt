// G2 — every action, on its hard case (R-B1 … R-B4).
//
// Each flow finds its references by reading the snapshot, acts through
// haunt_act, and asserts on the page's own record of what happened.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { ACTION_TYPES } from './contract.js';
import { type Session, gate, useGauntlet } from './harness.js';

// Deterministic pseudo-random strings for the round-trip property test.
function randomStrings(count: number, seed = 20261002): string[] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
  const ranges: Array<[number, number]> = [
    [0x20, 0x7e], // ASCII
    [0xa1, 0x17f], // Latin
    [0x391, 0x3c9], // Greek
    [0x5d0, 0x5ea], // Hebrew (right-to-left)
    [0x4e00, 0x4eff], // CJK
    [0x1f600, 0x1f64f], // emoji (astral plane)
  ];
  return Array.from({ length: count }, () => {
    const length = 1 + (next() % 40);
    let out = '';
    for (let i = 0; i < length; i++) {
      const [lo, hi] = ranges[next() % ranges.length];
      out += String.fromCodePoint(lo + (next() % (hi - lo + 1)));
    }
    return out;
  });
}

const HOSTILE_STRINGS = [
  'plain',
  'sign in now',
  'fill this in that field',
  '"double quoted"',
  "'single quoted'",
  '`backticks`',
  'back\\slash\\path',
  'tab\there',
  '  leading and trailing  ',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  "'; DROP TABLE users; --",
  '{{template}} ${interpolation} %s %d',
  'emoji 🙂 and family 👨‍👩‍👧‍👦',
  'combining é and ñ',
  'العربية من اليمين',
  'עברית',
  '日本語のテキスト',
  'zero​width',
  'non breaking',
  'null',
  'undefined',
  '0',
  '-1',
  '1e309',
  '../../etc/passwd',
  'https://example.com/?a=1&b=2#frag',
  '',
  'a',
  'x'.repeat(5_000),
];

describe('G2 every action on its hard case', () => {
  const ctx = useGauntlet();
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'haunt-gate-'));
  });
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });
  const fileAt = (name: string, text: string) => {
    const path = join(tmp, name);
    writeFileSync(path, text);
    return path;
  };

  gate(
    'G2.0',
    'R-B1',
    'haunt_act declares every action of the specification',
    async () => {
      const { tools } = await ctx.haunt.client.listTools();
      const act = tools.find((t) => t.name === 'haunt_act');
      expect(act).toBeDefined();
      const schema = JSON.stringify(act?.inputSchema);
      for (const type of ACTION_TYPES)
        expect(schema, type).toContain(`"${type}"`);
    },
  );

  describe('G2.1 click', () => {
    gate(
      'G2.1',
      'R-B1 R-A1',
      'the third of five identical buttons removes row 3 and only row 3',
      async () => {
        const s = await ctx.open('dupes');
        const deletes = await s.named('button', 'Delete');
        expect(deletes).toHaveLength(5);
        await s.ok({ type: 'click', ref: deletes[2].ref });
        expect((await s.state()).rows).toEqual([1, 2, 4, 5]);
        expect(await s.clicks()).toEqual(['delete-3']);
      },
    );

    gate(
      'G2.1',
      'R-B1 R-B3',
      'a click is one real, trusted pointer event',
      async () => {
        const s = await ctx.open('dupes');
        await s.ok({ type: 'click', ref: await s.ref('more-pricing') });
        const clicks = await s.events('click');
        expect(clicks).toHaveLength(1);
        expect(clicks[0]).toMatchObject({
          id: 'more-pricing',
          detail: { trusted: true, button: 0 },
        });
      },
    );

    gate(
      'G2.1',
      'R-B1',
      'right-click, double-click and modified click reach the page as such',
      async () => {
        const s = await ctx.open('dupes');
        const ref = await s.ref('more-release');
        await s.ok({ type: 'click', ref, button: 'right' });
        expect((await s.events('contextmenu')).map((e) => e.id)).toEqual([
          'more-release',
        ]);

        await s.ok({ type: 'click', ref, count: 2 });
        expect((await s.events('dblclick')).map((e) => e.id)).toEqual([
          'more-release',
        ]);

        await s.ok({ type: 'click', ref, modifiers: ['Shift'] });
        const last = (await s.events('click')).at(-1);
        expect(last?.detail).toMatchObject({ shift: true });
      },
    );

    gate(
      'G2.1',
      'R-B1 R-B2',
      'an offscreen element is scrolled into view and clicked',
      async () => {
        const s = await ctx.open('scroll');
        await s.ok({ type: 'click', ref: await s.ref('page-bottom') });
        expect(await s.status()).toBe('Reached the bottom');
      },
    );

    gate(
      'G2.1',
      'R-B1',
      'the right one of two same-named submit buttons is used',
      async () => {
        const s = await ctx.open('dupes');
        await s.ok(
          {
            type: 'fill',
            ref: await s.ref('register-email'),
            text: 'new@example.com',
          },
          { type: 'click', ref: await s.ref('register-submit') },
        );
        expect(await s.events('submit')).toEqual([
          expect.objectContaining({
            id: 'register',
            detail: { email: 'new@example.com', hasPassword: false },
          }),
        ]);
      },
    );
  });

  describe('G2.2 fill and type', () => {
    const VALUES: Array<[g: string, text: string, expected?: string]> = [
      ['text', 'Ada Lovelace'],
      ['email', 'ada@example.com'],
      ['password', 'correct horse'],
      ['number', '42'],
      ['tel', '+33 6 12 34 56 78'],
      ['url', 'https://example.com/a?b=c'],
      ['search', 'red shoes'],
      ['date', '1815-12-10'],
      ['time', '13:37'],
      ['datetime', '2026-10-02T09:30'],
      ['month', '2026-10'],
      ['week', '2026-W40'],
      ['color', '#ff8800'],
      ['range', '73'],
      ['textarea', 'line one\nline two'],
    ];

    gate('G2.2', 'R-B1', 'every input type takes a valid value', async () => {
      const s = await ctx.open('forms');
      for (const [id, text, expected] of VALUES) {
        await s.ok({ type: 'fill', ref: await s.ref(id), text });
        expect(await s.dom(id, 'el.value'), id).toBe(expected ?? text);
      }
    });

    gate(
      'G2.2',
      'R-B1',
      'fill replaces by default and appends with clear: false',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('text');
        await s.ok({ type: 'fill', ref, text: 'first' });
        await s.ok({ type: 'fill', ref, text: 'second' });
        expect(await s.dom('text', 'el.value')).toBe('second');
        await s.ok({ type: 'fill', ref, text: ' third', clear: false });
        expect(await s.dom('text', 'el.value')).toBe('second third');
      },
    );

    gate('G2.2', 'R-B1', 'fill with submit sends the form', async () => {
      const s = await ctx.open('dupes');
      await s.ok({
        type: 'fill',
        ref: await s.ref('login-email'),
        text: 'me@x.io',
        submit: true,
      });
      expect((await s.events('submit')).map((e) => e.id)).toEqual(['login']);
    });

    gate(
      'G2.2',
      'R-B1 R-B3',
      'the masked field needs real keys: fill leaves it empty, type fills it',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('masked');
        await s.act({ type: 'fill', ref, text: '5551234567' });
        expect((await s.state()).maskedDigits).toBe('');

        await s.ok({ type: 'type', ref, text: '5551234567' });
        expect((await s.state()).maskedDigits).toBe('5551234567');
        expect(await s.dom('masked', 'el.value')).toBe('(555) 123-4567');
      },
    );

    gate(
      'G2.2',
      'R-B1 R-B3',
      'the autocomplete needs real keys, then its option can be picked',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('city');
        await s.ok({ type: 'fill', ref, text: 'Pa' });
        expect((await s.state()).citySuggestions).toBeUndefined();

        await s.ok(
          { type: 'fill', ref, text: '' },
          { type: 'type', ref, text: 'Pa' },
        );
        expect((await s.state()).citySuggestions).toEqual(['Paris', 'Parma']);
        await s.ok({ type: 'click', ref: await s.ref('city-option-parma') });
        expect(await s.dom('city', 'el.value')).toBe('Parma');
      },
    );

    gate(
      'G2.2',
      'R-B1',
      'a field that reformats on blur ends with the reformatted value',
      async () => {
        const s = await ctx.open('forms');
        await s.ok(
          { type: 'fill', ref: await s.ref('price'), text: '1234.5' },
          { type: 'click', ref: await s.ref('text') },
        );
        expect(await s.dom('price', 'el.value')).toBe('1,234.50');
        expect((await s.element('price')).value).toBe('1,234.50');
      },
    );

    gate(
      'G2.2',
      'R-B1',
      'the field nothing names is still reachable by its reference',
      async () => {
        const s = await ctx.open('forms');
        await s.ok({
          type: 'fill',
          ref: await s.ref('unlabelled'),
          text: 'found you',
        });
        expect(await s.dom('unlabelled', 'el.value')).toBe('found you');
      },
    );

    gate(
      'G2.2',
      'R-B1',
      'contenteditable and the hidden-textarea editor take text',
      async () => {
        const s = await ctx.open('editor');
        await s.ok({
          type: 'fill',
          ref: await s.ref('rich'),
          text: 'Hello world',
        });
        expect((await s.state()).rich).toBe('Hello world');

        await s.ok({
          type: 'fill',
          ref: await s.ref('code'),
          text: 'const x = 1;',
        });
        expect((await s.state()).code).toBe('const x = 1;');
        expect(await s.page.locator('#code-view').textContent()).toBe(
          'const x = 1;',
        );
      },
    );

    gate(
      'G2.2',
      'R-B1',
      'type without a reference goes to the focused element',
      async () => {
        const s = await ctx.open('forms');
        await s.ok(
          { type: 'click', ref: await s.ref('text') },
          { type: 'type', text: 'typed where focus is' },
        );
        expect(await s.dom('text', 'el.value')).toBe('typed where focus is');
      },
    );
  });

  describe('G2.3 text is data', () => {
    gate(
      'G2.3',
      'R-B4',
      '30 hostile strings are read back exactly',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('textarea');
        for (const text of HOSTILE_STRINGS) {
          await s.ok({ type: 'fill', ref, text });
          expect(
            await s.dom('textarea', 'el.value'),
            JSON.stringify(text.slice(0, 40)),
          ).toBe(text);
        }
        // Markup was typed, never interpreted.
        expect(await s.page.locator('img[src=x]').count()).toBe(0);
      },
      120_000,
    );

    gate(
      'G2.3',
      'R-B4',
      'the same strings survive key-by-key typing',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('textarea');
        for (const text of HOSTILE_STRINGS.filter((t) => t.length < 100)) {
          await s.ok(
            { type: 'fill', ref, text: '' },
            { type: 'type', ref, text },
          );
          expect(
            await s.dom('textarea', 'el.value'),
            JSON.stringify(text),
          ).toBe(text);
        }
      },
      120_000,
    );

    gate(
      'G2.3',
      'R-B4',
      '200 random Unicode strings round-trip',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('text');
        for (const text of randomStrings(200)) {
          await s.ok({ type: 'fill', ref, text });
          expect(await s.dom('text', 'el.value')).toBe(text);
        }
      },
      180_000,
    );

    gate(
      'G2.3',
      'R-B4',
      'newlines stay newlines in a textarea and a contenteditable',
      async () => {
        const s = await ctx.open('editor');
        await s.ok({
          type: 'fill',
          ref: await s.ref('code'),
          text: 'a\n\tb\n\nc',
        });
        expect((await s.state()).code).toBe('a\n\tb\n\nc');
      },
    );
  });

  describe('G2.4 select and options', () => {
    gate(
      'G2.4',
      'R-B1',
      'a native select is set by label and by value',
      async () => {
        const s = await ctx.open('selects');
        const ref = await s.ref('native-single');
        await s.ok({ type: 'select', ref, values: ['Banana'] });
        expect(await s.dom('native-single', 'el.value')).toBe('banana');
        await s.ok({ type: 'select', ref, values: ['cherry'] });
        expect(await s.dom('native-single', 'el.value')).toBe('cherry');
        expect((await s.events('change')).map((e) => e.detail)).toEqual([
          'banana',
          'cherry',
        ]);
      },
    );

    gate(
      'G2.4',
      'R-B1',
      'a multiple select takes several values at once',
      async () => {
        const s = await ctx.open('selects');
        await s.ok({
          type: 'select',
          ref: await s.ref('native-multiple'),
          values: ['Ham', 'olives'],
        });
        expect(
          await s.dom(
            'native-multiple',
            '[...el.selectedOptions].map(o => o.value)',
          ),
        ).toEqual(['ham', 'olives']);
      },
    );

    gate(
      'G2.4',
      'R-B1',
      'options lists all 500 entries, and one of them can be selected',
      async () => {
        const s = await ctx.open('selects');
        const ref = await s.ref('native-huge');
        const listed = await s.ok({ type: 'options', ref });
        expect(listed.options).toHaveLength(500);
        expect(listed.options?.[436]).toEqual({
          label: 'Country 437',
          value: 'c437',
          selected: false,
          disabled: false,
        });
        await s.ok({ type: 'select', ref, values: ['Country 437'] });
        expect(await s.dom('native-huge', 'el.value')).toBe('c437');
      },
    );

    gate(
      'G2.4',
      'R-B1',
      'options reports a disabled entry as disabled',
      async () => {
        const s = await ctx.open('selects');
        const { options } = await s.ok({
          type: 'options',
          ref: await s.ref('native-single'),
        });
        expect(options?.find((o) => o.value === 'durian')).toMatchObject({
          disabled: true,
        });
      },
    );

    gate(
      'G2.4',
      'R-B1',
      'the portal listbox is opened and one of its options chosen',
      async () => {
        const s = await ctx.open('selects');
        const opened = await s.act({
          type: 'click',
          ref: await s.ref('listbox-trigger'),
        });
        // The options are announced by the action itself.
        expect(opened.diff.added.map((e) => e.name)).toContain('Purple');
        await s.ok({ type: 'click', ref: await s.ref('colour-purple') });
        expect((await s.state()).colour).toBe('Purple');
      },
    );

    gate(
      'G2.4',
      'R-B1 R-C4',
      'the async combobox: options that arrive 300 ms later are already in the result',
      async () => {
        const s = await ctx.open('selects');
        const typed = await s.act({
          type: 'type',
          ref: await s.ref('combo'),
          text: 'an',
        });
        expect(typed.diff.added.map((e) => e.name).sort()).toEqual([
          'Banana',
          'Mango',
          'Orange',
        ]);
        await s.ok({ type: 'click', ref: await s.ref('combo-option-mango') });
        expect((await s.state()).fruit).toBe('Mango');
      },
    );
  });

  describe('G2.5 check', () => {
    gate(
      'G2.5',
      'R-B1',
      'checkbox, radio and ARIA switch are set to a state',
      async () => {
        const s = await ctx.open('forms');
        await s.ok({ type: 'check', ref: await s.ref('terms'), checked: true });
        expect(await s.dom('terms', 'el.checked')).toBe(true);
        await s.ok({
          type: 'check',
          ref: await s.ref('terms'),
          checked: false,
        });
        expect(await s.dom('terms', 'el.checked')).toBe(false);

        await s.ok({
          type: 'check',
          ref: await s.ref('plan-team'),
          checked: true,
        });
        expect(await s.dom('plan-team', 'el.checked')).toBe(true);
        expect(await s.dom('plan-free', 'el.checked')).toBe(false);

        await s.ok({
          type: 'check',
          ref: await s.ref('switch'),
          checked: true,
        });
        expect(await s.dom('switch', 'el.getAttribute("aria-checked")')).toBe(
          'true',
        );
      },
    );

    gate(
      'G2.5',
      'R-B1',
      'asking for the state it already has does nothing at all',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('switch');
        await s.ok({ type: 'check', ref, checked: true });
        const again = await s.ok({ type: 'check', ref, checked: true });
        expect((await s.events('switch')).map((e) => e.detail)).toEqual([true]);
        expect(again.changes.none).toBe(true);
      },
    );
  });

  describe('G2.6 hover', () => {
    gate(
      'G2.6',
      'R-B1 R-B3',
      'the nested hover menu is walked and its last item clicked',
      async () => {
        const s = await ctx.open('hover');
        expect((await s.element('menu-download')).hidden).toBe('display');
        await s.ok({ type: 'hover', ref: await s.ref('menu-products') });
        await s.ok({ type: 'hover', ref: await s.ref('menu-software') });
        expect((await s.element('menu-download')).hidden).toBeUndefined();
        await s.ok({ type: 'click', ref: await s.ref('menu-download') });
        expect(await s.status()).toBe('Opened download');
      },
    );

    gate(
      'G2.6',
      'R-B1 R-C3',
      'hovering an icon button reveals the name it does not otherwise have',
      async () => {
        const s = await ctx.open('hover');
        const hovered = await s.act({
          type: 'hover',
          ref: await s.ref('icon-trash'),
        });
        expect(hovered.results[0].ok).toBe(true);
        const text = (await s.capture({ format: 'text' })).text;
        expect(text).toContain('Move to trash');
        expect((await s.events('tooltip')).map((e) => e.id)).toEqual([
          'icon-trash',
        ]);
      },
    );
  });

  describe('G2.7 drag', () => {
    gate(
      'G2.7',
      'R-B1 R-B3',
      'the sortable list is put in a requested order',
      async () => {
        const s = await ctx.open('dnd');
        // Target order: Echo, Delta, Charlie, Bravo, Alpha.
        const wanted = ['echo', 'delta', 'charlie', 'bravo', 'alpha'];
        for (let position = 0; position < wanted.length - 1; position++) {
          const current: string[] = (await s.state()).order.map((n: string) =>
            n.toLowerCase(),
          );
          if (current[position] === wanted[position]) continue;
          await s.ok({
            type: 'drag',
            from_ref: await s.ref(`item-${wanted[position]}`),
            to_ref: await s.ref(`item-${current[position]}`),
          });
        }
        expect((await s.state()).order).toEqual([
          'Echo',
          'Delta',
          'Charlie',
          'Bravo',
          'Alpha',
        ]);
      },
    );

    gate(
      'G2.7',
      'R-B1',
      'a card moves between columns with native drag events',
      async () => {
        const s = await ctx.open('dnd');
        await s.ok({
          type: 'drag',
          from_ref: await s.ref('card-2'),
          to_ref: await s.ref('card-3'),
        });
        expect((await s.state()).board).toEqual({
          todo: ['card-1'],
          done: ['card-3', 'card-2'],
        });
      },
    );

    gate('G2.7', 'R-B1', 'the slider is dragged to exactly 73', async () => {
      const s = await ctx.open('dnd');
      // From 20 to 73 on a track of 3 px per unit.
      await s.ok({
        type: 'drag',
        from_ref: await s.ref('slider-thumb'),
        offset: { x: 53 * 3, y: 0 },
      });
      expect((await s.state()).slider).toBe(73);
      expect((await s.element('slider-thumb')).value).toBe('73');
    });

    gate('G2.7', 'R-B1', 'the panel is resized to 400 px', async () => {
      const s = await ctx.open('dnd');
      await s.ok({
        type: 'drag',
        from_ref: await s.ref('resize-handle'),
        offset: { x: 150, y: 0 },
      });
      const width: number = (await s.state()).panelWidth;
      expect(Math.abs(width - 400)).toBeLessThanOrEqual(2);
    });
  });

  describe('G2.8 upload', () => {
    gate(
      'G2.8',
      'R-B1',
      'one file on a plain input arrives with its content',
      async () => {
        const s = await ctx.open('upload');
        await s.ok({
          type: 'upload',
          ref: await s.ref('plain'),
          files: [fileAt('a.txt', 'alpha')],
        });
        await expect
          .poll(async () => (await s.state()).uploads.plain)
          .toEqual([{ name: 'a.txt', size: 5, text: 'alpha' }]);
      },
    );

    gate(
      'G2.8',
      'R-B1',
      'a styled button in front of a hidden input takes the file',
      async () => {
        const s = await ctx.open('upload');
        await s.ok({
          type: 'upload',
          ref: await s.ref('styled-button'),
          files: [fileAt('doc.txt', 'document')],
        });
        await expect
          .poll(async () => (await s.state()).uploads.styled?.[0])
          .toEqual({
            name: 'doc.txt',
            size: 8,
            text: 'document',
          });
      },
    );

    gate('G2.8', 'R-B1', 'three files on the drop zone', async () => {
      const s = await ctx.open('upload');
      const files = ['one', 'two', 'three'].map((n) => fileAt(`${n}.txt`, n));
      await s.ok({ type: 'upload', ref: await s.ref('zone'), files });
      await expect
        .poll(async () =>
          (await s.state()).uploads.zone?.map((f: { name: string }) => f.name),
        )
        .toEqual(['one.txt', 'two.txt', 'three.txt']);
    });

    gate(
      'G2.8',
      'R-B1 R-C3',
      'a file the page rejects is reported as rejected by the page',
      async () => {
        const s = await ctx.open('upload');
        const result = await s.act({
          type: 'upload',
          ref: await s.ref('images'),
          files: [fileAt('ok.png', 'png'), fileAt('notes.txt', 'txt')],
        });
        expect(result.results[0].ok).toBe(true);
        await expect
          .poll(async () => (await s.state()).rejected.images)
          .toEqual(['notes.txt']);
        expect((await s.capture({ format: 'text' })).text).toContain(
          'notes.txt rejected — only .png and .jpg are allowed',
        );
      },
    );
  });

  describe('G2.9 scroll and scroll_to', () => {
    gate(
      'G2.9',
      'R-B1',
      'item 200 of the infinite list is reached and clicked',
      async () => {
        const s = await ctx.open('scroll');
        const list = await s.ref('infinite');
        for (let i = 0; i < 40 && (await s.state()).loaded < 200; i++) {
          await s.ok({
            type: 'scroll',
            direction: 'down',
            amount: 5_000,
            ref: list,
          });
        }
        expect((await s.state()).loaded).toBeGreaterThanOrEqual(200);
        await s.ok({ type: 'click', ref: await s.ref('item-200') });
        expect(await s.status()).toBe('Opened Item 200');
      },
      60_000,
    );

    gate(
      'G2.9',
      'R-B1',
      'row 4,321 of the virtualised list is reached and clicked',
      async () => {
        const s = await ctx.open('scroll');
        await s.ok({
          type: 'scroll',
          direction: 'down',
          amount: 4320 * 30,
          ref: await s.ref('virtual'),
        });
        await s.ok({ type: 'click', ref: await s.ref('row-4321') });
        expect(await s.status()).toBe('Opened row 4321');
      },
    );

    gate(
      'G2.9',
      'R-B1',
      'scrolling the inner container leaves the outer one where it is',
      async () => {
        const s = await ctx.open('scroll');
        await s.ok({
          type: 'scroll',
          direction: 'down',
          amount: 400,
          ref: await s.ref('inner'),
        });
        expect(await s.dom('inner', 'el.scrollTop')).toBe(400);
        expect(await s.dom('outer', 'el.scrollTop')).toBe(0);
        await s.ok({ type: 'click', ref: await s.ref('inner-action') });
        expect(await s.status()).toBe('Inner action done');
      },
    );

    gate(
      'G2.9',
      'R-B1',
      'the last column of the wide table is reached horizontally',
      async () => {
        const s = await ctx.open('scroll');
        await s.ok({
          type: 'scroll',
          direction: 'right',
          amount: 10_000,
          ref: await s.ref('wide'),
        });
        expect(await s.dom<number>('wide', 'el.scrollLeft')).toBeGreaterThan(
          3_000,
        );
        expect((await s.element('wide-action')).offscreen).toBeFalsy();
      },
    );

    gate(
      'G2.9',
      'R-B1',
      'page scroll moves by the amount asked, and by one viewport by default',
      async () => {
        const s = await ctx.open('scroll');
        await s.ok({ type: 'scroll', direction: 'down', amount: 600 });
        expect(await s.page.evaluate(() => scrollY)).toBe(600);
        await s.ok({ type: 'scroll', direction: 'down' });
        const viewport = await s.page.evaluate(() => innerHeight);
        expect(await s.page.evaluate(() => scrollY)).toBe(600 + viewport);
        await s.ok({ type: 'scroll', direction: 'up', amount: 100_000 });
        expect(await s.page.evaluate(() => scrollY)).toBe(0);
      },
    );

    gate(
      'G2.9',
      'R-B1',
      'scroll_to brings an element, or the first match of a text, into view',
      async () => {
        const s = await ctx.open('scroll');
        await s.ok({ type: 'scroll_to', ref: await s.ref('page-bottom') });
        expect((await s.element('page-bottom')).offscreen).toBeFalsy();

        await s.ok({
          type: 'scroll_to',
          text: 'A scroll area inside a scroll area',
        });
        const top = await s.page.evaluate(() => {
          const heading = [...document.querySelectorAll('h2')].find((h) =>
            h.textContent?.startsWith('A scroll area inside'),
          );
          return heading?.getBoundingClientRect().top ?? -1;
        });
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThan(await s.page.evaluate(() => innerHeight));
      },
    );
  });

  describe('G2.10 tabs', () => {
    for (const [id, from] of [
      ['blank-link', 'link'],
      ['open-button', 'button'],
    ] as const) {
      gate(
        'G2.10',
        'R-B1 R-C2',
        `${id}: the new tab is announced, switched to, used and closed`,
        async () => {
          const s = await ctx.open('tabs');
          const opened = await s.act({ type: 'click', ref: await s.ref(id) });
          expect(opened.results[0].changes.tabs_opened).toEqual([1]);

          await s.ok({ type: 'tab', op: 'switch', index: 1 });
          expect((await s.snapshot()).title).toBe('Gauntlet — child tab');
          await s.ok({ type: 'click', ref: await s.ref('child-confirm') });

          await s.ok({ type: 'tab', op: 'close', index: 1 });
          const back = await s.snapshot();
          expect(back.tabs).toHaveLength(1);
          expect(back.title).toBe('Gauntlet — tabs');
          expect((await s.state()).childMessages).toEqual([
            `confirmed from ${from}`,
          ]);
        },
      );
    }

    gate(
      'G2.10',
      'R-B1 R-C2',
      'a popup that closes itself is reported as opened and closed',
      async () => {
        const s = await ctx.open('tabs');
        const result = await s.act({
          type: 'click',
          ref: await s.ref('closing-button'),
        });
        const changes = result.results[0].changes;
        expect(changes.tabs_opened).toEqual([1]);
        await s.ok({ type: 'wait_for', ms: 900 });
        expect((await s.snapshot()).tabs).toHaveLength(1);
        expect(s.pages).toHaveLength(1);
      },
    );

    gate('G2.10', 'R-B1', 'a new tab can be opened on a URL', async () => {
      const s = await ctx.open('tabs');
      await s.ok({ type: 'tab', op: 'new', url: ctx.gauntlet.url('dupes') });
      const snap = await s.snapshot();
      expect(snap.tabs).toHaveLength(2);
      expect(snap.title).toBe('Gauntlet — duplicates');
    });
  });

  describe('G2.11 dialogs', () => {
    async function withDialog(s: Session, g: string) {
      const result = await s.act({ type: 'click', ref: await s.ref(g) });
      expect(result.results[0].ok).toBe(true);
      return result.results[0].changes.dialog;
    }

    gate(
      'G2.11',
      'R-B1 R-C2',
      'alert, confirm and prompt are reported with their message and answered',
      async () => {
        const s = await ctx.open('dialogs');

        expect(await withDialog(s, 'alert')).toEqual({
          type: 'alert',
          message: 'Maintenance tonight at 22:00',
        });
        await s.ok({ type: 'dialog', accept: true });

        expect(await withDialog(s, 'confirm')).toMatchObject({
          type: 'confirm',
        });
        await s.ok({ type: 'dialog', accept: false });
        expect(await s.status()).toBe('Deletion cancelled');

        expect(await withDialog(s, 'prompt')).toEqual({
          type: 'prompt',
          message: 'New project name',
        });
        await s.ok({ type: 'dialog', accept: true, text: 'Gemini' });
        expect(await s.status()).toBe('Renamed to Gemini');

        expect((await s.events('dialog')).map((e) => e.detail)).toEqual([
          'closed',
          false,
          'Gemini',
        ]);
      },
    );

    gate(
      'G2.11',
      'R-B1',
      'confirm accepted and prompt dismissed take the other branch',
      async () => {
        const s = await ctx.open('dialogs');
        await withDialog(s, 'confirm');
        await s.ok({ type: 'dialog', accept: true });
        expect(await s.status()).toBe('Project deleted');
        await withDialog(s, 'prompt');
        await s.ok({ type: 'dialog', accept: false });
        expect(await s.status()).toBe('Rename cancelled');
      },
    );

    gate(
      'G2.11',
      'R-B1 R-C2 R-C4',
      'a dialog raised 500 ms after the click is reported by that click',
      async () => {
        const s = await ctx.open('dialogs');
        expect(await withDialog(s, 'late')).toEqual({
          type: 'alert',
          message: 'Saved, but 2 fields were ignored',
        });
        await s.ok({ type: 'dialog', accept: true });
        expect(await s.status()).toBe('Saved with warnings');
      },
    );

    gate(
      'G2.11',
      'R-B1',
      'the leave-page guard is reported and can be accepted',
      async () => {
        const s = await ctx.open('dialogs');
        await s.ok({ type: 'check', ref: await s.ref('guard'), checked: true });
        const dialog = await withDialog(s, 'leave');
        expect(dialog).toMatchObject({ type: 'beforeunload' });
        await s.ok({ type: 'dialog', accept: true });
        await expect.poll(async () => (await s.state()).left).toBe(true);
      },
    );
  });

  describe('G2.12 history', () => {
    gate(
      'G2.12',
      'R-B1',
      'back, forward and reload on pushState navigation',
      async () => {
        const s = await ctx.open('spa');
        const boot = (await s.state()).bootId;
        await s.ok({ type: 'click', ref: await s.ref('nav-profile') });
        await s.ok({ type: 'back' });
        expect((await s.state()).route).toBe('home');
        await s.ok({ type: 'forward' });
        expect((await s.state()).route).toBe('profile');
        expect((await s.state()).bootId).toBe(boot);

        await s.ok({ type: 'reload' });
        expect((await s.state()).route).toBe('profile');
        expect((await s.state()).bootId).not.toBe(boot);
      },
    );

    gate(
      'G2.12',
      'R-B1',
      'back on a full-page navigation, with the form state checked afterwards',
      async () => {
        const s = await ctx.open('tabs');
        await s.ok({ type: 'click', ref: await s.ref('same-tab-link') });
        expect((await s.snapshot()).title).toBe('Gauntlet — child tab');
        await s.ok({ type: 'back' });
        expect((await s.snapshot()).title).toBe('Gauntlet — tabs');

        await s.ok({ type: 'goto', url: ctx.gauntlet.url('dupes') });
        await s.ok({
          type: 'fill',
          ref: await s.ref('login-email'),
          text: 'kept@x.io',
        });
        await s.ok({ type: 'goto', url: ctx.gauntlet.url('forms') });
        await s.ok({ type: 'back' });
        // Whatever the browser restored is what the snapshot must say.
        expect((await s.element('login-email')).value ?? '').toBe(
          await s.dom('login-email', 'el.value'),
        );
      },
    );
  });

  describe('G2.13 wait_for', () => {
    gate(
      'G2.13',
      'R-B1',
      'each condition succeeds when it is met',
      async () => {
        const s = await ctx.open('dynamic');
        await s.ok({
          type: 'wait_for',
          text: 'Download invoice',
          timeout_ms: 4_000,
        });
        await s.ok({ type: 'wait_for', ref: await s.ref('late-action') });

        const spa = await ctx.open('spa');
        await spa.ok({ type: 'click', ref: await spa.ref('nav-slow') });
        await spa.ok({
          type: 'wait_for',
          gone: 'Loading report…',
          timeout_ms: 4_000,
        });
        await spa.ok({ type: 'wait_for', url: '/spa/slow' });
        expect(await spa.page.locator('#slow-status').textContent()).toBe(
          'Report ready',
        );
      },
    );

    gate(
      'G2.13',
      'R-B1',
      'a fixed wait takes about as long as asked',
      async () => {
        const s = await ctx.open('forms');
        const start = performance.now();
        await s.ok({ type: 'wait_for', ms: 600 });
        const elapsed = performance.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(600);
        expect(elapsed).toBeLessThan(1_500);
      },
    );

    gate(
      'G2.13',
      'R-B1 R-D1',
      'an unmet condition times out and says what was there instead',
      async () => {
        const s = await ctx.open('forms');
        const error = await s.fail({
          type: 'wait_for',
          text: 'Payment received',
          timeout_ms: 700,
        });
        expect(error.code).toBe('timeout');
        expect(error.observed).toBeTruthy();
      },
    );
  });

  describe('G2.14 resize', () => {
    gate('G2.14', 'R-B1', 'the viewport takes the requested size', async () => {
      const s = await ctx.open('overlays', 'case=banner');
      await s.ok({ type: 'resize', width: 375, height: 667 });
      expect(await s.page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        375, 667,
      ]);
      // The layout follows: the banner still pins the footer link.
      expect((await s.element('target')).covered_by).toBe(
        await s.ref('banner'),
      );
    });
  });

  describe('G2.15 read', () => {
    gate(
      'G2.15',
      'R-B1',
      'read returns the text of the page, or of one region',
      async () => {
        const s = await ctx.open('dupes');
        const normalise = (t: string) => t.replace(/\s+/g, ' ').trim();

        const page = await s.ok({ type: 'read' });
        expect(normalise(page.text ?? '')).toBe(
          normalise(await s.page.evaluate(() => document.body.innerText)),
        );

        const scroll = await ctx.open('scroll');
        const region = await scroll.ok({
          type: 'read',
          ref: await scroll.ref('inner'),
        });
        expect(normalise(region.text ?? '')).toBe(
          normalise(await scroll.dom('inner', 'el.innerText')),
        );
        expect(region.text).toContain('Inner line 40');
      },
    );
  });

  describe('G2.16 the same flows inside shadow roots and frames', () => {
    for (const prefix of ['open', 'closed'] as const) {
      gate(
        'G2.16',
        'R-B1 R-A3',
        `a form in a ${prefix} shadow root is filled, set and submitted`,
        async () => {
          const s = await ctx.open('shadow');
          await s.ok(
            { type: 'fill', ref: await s.ref(`${prefix}-name`), text: 'Grace' },
            {
              type: 'check',
              ref: await s.ref(`${prefix}-agree`),
              checked: true,
            },
            {
              type: 'select',
              ref: await s.ref(`${prefix}-size`),
              values: ['Large'],
            },
            { type: 'click', ref: await s.ref(`${prefix}-save`) },
          );
          expect(await s.events('submit')).toEqual([
            expect.objectContaining({
              id: prefix,
              detail: { nickname: 'Grace', agree: 'on', size: 'l' },
            }),
          ]);
        },
      );
    }

    gate(
      'G2.16',
      'R-B1 R-A3',
      'the control three roots deep is clicked',
      async () => {
        const s = await ctx.open('shadow');
        await s.ok({ type: 'click', ref: await s.ref('deep-button') });
        expect(await s.clicks()).toEqual(['deep-button']);
      },
    );

    for (const name of ['same', 'cross', 'inner', 'late'] as const) {
      gate(
        'G2.16',
        'R-B1 R-A3',
        `the form in the ${name} frame is filled and sent`,
        async () => {
          const s = await ctx.open('frames');
          await s.page.waitForTimeout(1_300);
          const frame = await s.frame(name);
          const { elements, containers = [] } = await s.snapshot();
          const inFrame = (g: string) => {
            const found = elements.filter(
              (e) =>
                e.attributes?.['data-g'] === g &&
                containers
                  .find((c) => c.id === e.path.at(-1))
                  ?.url?.includes(`name=${name}`),
            );
            expect(found).toHaveLength(1);
            return found[0].ref;
          };

          await s.ok(
            { type: 'fill', ref: inFrame('comment'), text: `hello ${name}` },
            { type: 'click', ref: inFrame('send') },
          );
          expect(await s.events('submit', frame)).toEqual([
            expect.objectContaining({ id: name, detail: `hello ${name}` }),
          ]);
          expect(await s.events('click', frame)).toEqual([
            expect.objectContaining({
              id: 'send',
              detail: expect.objectContaining({ trusted: true }),
            }),
          ]);
        },
      );
    }
  });

  describe('G2.17 press', () => {
    gate(
      'G2.17',
      'R-B1',
      'keys, chords and sequences reach the focused element',
      async () => {
        const s = await ctx.open('forms');
        const ref = await s.ref('text');
        await s.ok({ type: 'fill', ref, text: 'hello world' });
        await s.ok({ type: 'press', ref, keys: 'ControlOrMeta+A' });
        await s.ok({ type: 'press', ref, keys: ['x', 'y', 'z'] });
        expect(await s.dom('text', 'el.value')).toBe('xyz');

        await s.ok({ type: 'press', ref, keys: 'Enter' });
        expect((await s.events('submit')).map((e) => e.id)).toEqual(['main']);
      },
    );

    gate(
      'G2.17',
      'R-B1',
      'a keyboard-operated switch and slider respond',
      async () => {
        const s = await ctx.open('forms');
        await s.ok({ type: 'press', ref: await s.ref('switch'), keys: ' ' });
        expect((await s.events('switch')).map((e) => e.detail)).toEqual([true]);

        const dnd = await ctx.open('dnd');
        await dnd.ok({
          type: 'press',
          ref: await dnd.ref('slider-thumb'),
          keys: ['ArrowRight', 'ArrowRight', 'ArrowRight'],
        });
        expect((await dnd.state()).slider).toBe(23);
      },
    );
  });
});
