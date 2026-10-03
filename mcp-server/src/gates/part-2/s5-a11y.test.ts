import type { Frame, Page } from 'playwright';
// S5 — accessibility (R-S15 … R-S17).
import { describe, expect } from 'vitest';
import type { A11ySignal, Signal } from './contract.js';
import {
  type SignalSession,
  TRUTH,
  expectExactly,
  gate,
  useSignals,
} from './harness.js';

const a11y = (signals: Signal[]) =>
  signals.filter((s): s is A11ySignal => s.kind === 'a11y');
const rules = (signals: Signal[]) =>
  a11y(signals)
    .map((s) => s.rule)
    .sort();

const EXPECTED = TRUTH['sig-a11y'].load;
const TWELVE = EXPECTED.map((s) => String(s.signal.rule)).sort();

// Offending elements a user can act on: each has a reference in the
// snapshot, so the signal has to name it.
const REFERENCED = [
  'icon-button',
  'shadow-button',
  'icon-link',
  'search',
  'country',
  'terms',
  'mute',
];

// The snapshot reference of each element carrying data-g, when it has one.
async function refsByGauntletId(session: SignalSession) {
  const { elements } = await session.s.snapshot();
  const refs = new Map<string, string>();
  for (const element of elements) {
    const g = element.attributes?.['data-g'];
    if (g) refs.set(g, element.ref);
  }
  return refs;
}

// Everything a page script could see change.
async function fingerprint(page: Page) {
  const read = (frame: Frame) =>
    frame.evaluate(() => ({
      html: document.documentElement.outerHTML,
      globals: Object.getOwnPropertyNames(window).sort(),
      events: JSON.stringify(window.__gauntlet.events),
      registry: window.__gauntlet.ids(),
      focus: document.activeElement?.getAttribute('data-g') ?? null,
      scroll: [scrollX, scrollY],
    }));
  return Promise.all(page.frames().map(read));
}

describe('S5 accessibility', () => {
  const ctx = useSignals();

  describe('S5.1 the twelve violations', () => {
    gate(
      'S5.1',
      'R-S15 R-S16',
      'sig-a11y buggy: exactly the twelve rules, each naming its elements',
      async () => {
        const session = await ctx.sig('sig-a11y');
        expectExactly(session.atSpawn, EXPECTED, 'sig-a11y');
        expect(rules(session.atSpawn)).toEqual(TWELVE);
        expect(session.atSpawn.every((s) => s.step === 0)).toBe(true);

        const refs = await refsByGauntletId(session);
        for (const id of REFERENCED) expect(refs.has(id), id).toBe(true);

        for (const expected of EXPECTED) {
          const signal = a11y(session.atSpawn).find(
            (s) => s.rule === expected.signal.rule,
          );
          if (!signal) throw new Error(`no ${expected.signal.rule}`);
          const elements = expected.elements ?? [];
          // The rules about the document itself name one node and no
          // element.
          expect(signal.nodes, signal.rule).toBe(Math.max(1, elements.length));
          // Every offending element that has a reference, and nothing else.
          const wanted = elements
            .map((e) => refs.get(e.id))
            .filter((ref): ref is string => ref !== undefined);
          expect([...signal.refs].sort(), signal.rule).toEqual(wanted.sort());
          expect(signal.help.length, signal.rule).toBeGreaterThan(10);
        }
      },
    );

    gate('S5.1', 'R-S15', 'sig-a11y clean: none', async () => {
      const session = await ctx.sig('sig-a11y', 'clean');
      expect(session.atSpawn).toEqual([]);
      // Nothing at load proves nothing until the page is known to have been
      // audited: an engine without the audit is silent too.
      expect(await session.capture({ audit: true })).toEqual([]);
      // And the page under it is the same page: same controls.
      const refs = await refsByGauntletId(session);
      for (const id of REFERENCED) expect(refs.has(id), id).toBe(true);
    });
  });

  describe('S5.2 once per page', () => {
    gate(
      'S5.2',
      'R-S15',
      'a page visited five times in a session is audited once',
      async () => {
        const session = await ctx.sig('sig-a11y');
        const url = ctx.gauntlet.url('sig-a11y', 'variant=buggy');
        // The same page under another query string is the same page.
        const again = [url, `${url}&tab=2`, url, `${url}&tab=3`];
        for (const target of again) {
          const result = await session.act({ type: 'goto', url: target });
          expect(result.results[0].ok).toBe(true);
          expect(a11y(result.signals)).toEqual([]);
        }
        await session.end();
        expect(rules(session.all())).toEqual(TWELVE);
        expect(a11y(session.all()).every((s) => s.step === 0)).toBe(true);
      },
    );

    gate(
      'S5.2',
      'R-S15',
      'another page of the same session is audited too, at the step that reached it',
      async () => {
        const session = await ctx.sig('sig-a11y', 'clean');
        expect(session.atSpawn).toEqual([]);
        const result = await session.act({
          type: 'goto',
          url: ctx.gauntlet.url('sig-a11y', 'variant=buggy'),
        });
        // Same path, so already audited: nothing.
        expect(a11y(result.signals)).toEqual([]);

        const other = await session.act({
          type: 'goto',
          url: ctx.gauntlet.url('forms'),
        });
        await session.end();
        const found = a11y(session.all());
        expect(found.map((s) => [s.rule, s.step])).toEqual([
          ['label', other.step],
        ]);
      },
    );

    gate(
      'S5.2',
      'R-S15',
      'an explicit request audits the page as it is now',
      async () => {
        const session = await ctx.sig('sig-a11y');
        expect(rules(await session.capture({ audit: true }))).toEqual(TWELVE);

        // Behind the tools' back: one violation fixed, and a third image
        // without alt added.
        await session.s.page.evaluate(() => {
          window.__gauntlet.find('mute').setAttribute('aria-pressed', 'false');
          const image = document.createElement('img');
          image.src = window.__gauntlet.find('logo').src;
          document.body.append(image);
        });
        const now = a11y(await session.capture({ audit: true }));
        expect(rules(now)).toEqual(
          TWELVE.filter((rule) => rule !== 'aria-valid-attr-value'),
        );
        expect(now.find((s) => s.rule === 'image-alt')?.nodes).toBe(3);

        // Without the request, nothing is audited again.
        const result = await session.act({ type: 'read' });
        expect(a11y(result.signals)).toEqual([]);
      },
    );
  });

  describe('S5.3 frames and shadow roots', () => {
    gate(
      'S5.3',
      'R-S16',
      'a violation inside a frame and one inside an open shadow root are found',
      async () => {
        const session = await ctx.sig('sig-a11y');
        const refs = await refsByGauntletId(session);
        const byRule = new Map(a11y(session.atSpawn).map((s) => [s.rule, s]));

        // The image in the frame, beside the one in the page.
        expect(byRule.get('image-alt')?.nodes).toBe(2);
        // The button in the shadow root, beside the one in the page.
        const buttons = byRule.get('button-name');
        expect(buttons?.nodes).toBe(2);
        expect(buttons?.refs).toContain(refs.get('shadow-button'));
        expect(buttons?.refs).toContain(refs.get('icon-button'));

        // They are there: the page's own registry has both, and the frame's
        // has the image.
        expect(await session.s.registry()).toContain('shadow-button');
        const frame = session.s.page
          .frames()
          .find((f) => f.url().includes('/frame/sig-note'));
        if (!frame) throw new Error('no note frame');
        expect(await session.s.registry(frame)).toEqual(['frame-photo']);
      },
    );
  });

  describe('S5.4 the audit does not disturb the page', () => {
    gate(
      'S5.4',
      'R-S17',
      'the DOM, the page’s globals, its record of events and the snapshot are the same before and after',
      async () => {
        const session = await ctx.sig('sig-a11y');
        await session.click('mute');
        const before = await fingerprint(session.s.page);
        const snapshotBefore = await session.s.snapshot();

        expect(rules(await session.capture({ audit: true }))).toEqual(TWELVE);

        expect(await fingerprint(session.s.page)).toEqual(before);
        const snapshotAfter = await session.s.snapshot();
        expect(snapshotAfter.elements).toEqual(snapshotBefore.elements);
        expect(snapshotAfter.text).toBe(snapshotBefore.text);
        // axe-core is nowhere a page script could find it.
        for (const frame of session.s.page.frames()) {
          expect(
            await frame.evaluate(() => 'axe' in window || 'axeCore' in window),
          ).toBe(false);
        }
      },
    );

    gate(
      'S5.4',
      'R-S17',
      'auditing the 2,000-element page raises no signal, though it holds the main thread for seconds',
      async () => {
        const session = await ctx.part1('huge');
        expect(session.atSpawn).toEqual([]);
        expect(await session.capture({ audit: true })).toEqual([]);
        const result = await session.act({ type: 'read' });
        await session.end();
        expect(result.signals).toEqual([]);
        expect(session.all()).toEqual([]);
      },
      60_000,
    );

    gate(
      'S5.4',
      'R-S17',
      'the audit’s time is not counted in the action that reached the page',
      async () => {
        const session = await ctx.sig('sig-a11y', 'clean');
        const result = await session.act({
          type: 'goto',
          url: ctx.gauntlet.url('huge'),
        });
        const [step] = result.results;
        expect(step.ok).toBe(true);

        // Auditing this page takes several times longer than loading it,
        // on any machine: measured here rather than assumed.
        const start = performance.now();
        expect(await session.capture({ audit: true })).toEqual([]);
        const auditMs = performance.now() - start;
        expect(step.action_ms + step.settle_ms).toBeLessThan(auditMs / 2);
        await session.end();
        expect(session.all()).toEqual([]);
      },
      60_000,
    );
  });
});
