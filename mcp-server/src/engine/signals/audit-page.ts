// mcp-server/src/engine/signals/audit-page.ts
//
// The accessibility audit's half that runs in the page (signals/audit.ts is
// the other). Serialised with toString(): each function is self-contained.
//
// axe-core is kept on the engine's own state (window.__haunt.axe), never on
// window, and every stretch of main-thread time it takes is recorded as the
// engine's, so that the audit neither shows to the page nor is reported as
// the page's long task (R-S17).

// One frame's violations, each offending element as the snapshot keys it:
// its document and its local id there.
export async function auditFrame(args: {
  options: Record<string, unknown>;
  top: boolean;
  contrastCap: number;
}): Promise<Array<{
  rule: string;
  impact: string;
  help: string;
  nodes: number;
  elements: Array<[string, number]>;
  sample?: { checked: number; of: number };
}> | null> {
  interface AuditState {
    doc: string;
    ids: WeakMap<Node, number>;
    nodes: Map<number, WeakRef<Node>>;
    next: number;
    work?: Array<[number, number]>;
    silent?: number;
    // biome-ignore lint/suspicious/noExplicitAny: axe-core, loaded by audit.ts
    axe?: any;
  }
  const state = (window as unknown as { __haunt?: AuditState }).__haunt;
  if (!state?.axe) return null;
  const { axe } = state;
  const began = performance.now();
  state.silent = (state.silent ?? 0) + 1;
  try {
    // Each frame is audited on its own (axe-core's way of reaching into
    // frames, messages between them, would reach the page's own message
    // listeners); the rules about the whole page are the top frame's, as
    // axe-core has them when it reaches frames itself.
    const rules: Record<string, { enabled: boolean }> = {};
    if (!args.top) {
      // biome-ignore lint/suspicious/noExplicitAny: axe-core's rule objects
      for (const rule of axe._audit.rules as any[]) {
        if (rule.pageLevel) rules[rule.id] = { enabled: false };
      }
    }
    // color-contrast is nearly all of an audit's time on a long page: 26 of
    // 30 s on the gauntlet's 2,000-element page, paid at every spawn. Past
    // a number of text elements it is checked on a sample of them, those on
    // screen first, then in document order. A contrast defect comes from a
    // style, repeated: a sample finds it.
    const CONTRAST = 'color-contrast';
    const holders: Element[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(
      document.body ?? document.documentElement,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.nodeValue?.trim()) continue;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
      seen.add(el);
      holders.push(el);
    }
    const sampled = holders.length > args.contrastCap;
    if (sampled) rules[CONTRAST] = { enabled: false };
    const results = await axe.run(document, {
      ...args.options,
      iframes: false,
      elementRef: true,
      rules,
    });
    // Said of every frame, so that a page whose frames were checked whole
    // and in part counts both.
    let sample = { checked: holders.length, of: holders.length };
    if (sampled) {
      // Only elements with no other text element inside: checking one
      // checks what is under it, and the sample has to stay a sample.
      const above = new Set<Element>();
      for (const el of holders) {
        for (let up = el.parentElement; up && !above.has(up); ) {
          above.add(up);
          up = up.parentElement;
        }
      }
      const leaves = holders.filter((el) => !above.has(el));
      const onScreen = (el: Element) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.bottom > 0 &&
          r.right > 0 &&
          r.top < innerHeight &&
          r.left < innerWidth
        );
      };
      const chosen = [
        ...leaves.filter(onScreen),
        ...leaves.filter((el) => !onScreen(el)),
      ].slice(0, args.contrastCap);
      const contrast = await axe.run(
        { include: chosen },
        {
          runOnly: { type: 'rule', values: [CONTRAST] },
          resultTypes: ['violations'],
          iframes: false,
          elementRef: true,
        },
      );
      results.violations.push(...contrast.violations);
      sample = { checked: chosen.length, of: holders.length };
    }
    const localOf = (el: Element): [string, number] => {
      let id = state.ids.get(el);
      if (!id) {
        id = state.next++;
        state.ids.set(el, id);
        state.nodes.set(id, new WeakRef(el));
      }
      return [state.doc, id];
    };
    // biome-ignore lint/suspicious/noExplicitAny: axe-core's result
    return results.violations.map((v: any) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      ...(v.id === CONTRAST ? { sample } : {}),
      nodes: v.nodes.length,
      elements: v.nodes
        // biome-ignore lint/suspicious/noExplicitAny: axe-core's result
        .map((n: any) => n.element)
        .filter((el: unknown): el is Element => el instanceof Element)
        .map(localOf),
    }));
  } finally {
    state.silent -= 1;
    const end = performance.now();
    try {
      const top = (window.top as unknown as { __haunt?: AuditState }).__haunt;
      const shift =
        performance.timeOrigin - (window.top as Window).performance.timeOrigin;
      top?.work?.push([began + shift, end + shift]);
    } catch {
      // A frame of another origin: its time is not the top page's anyway.
    }
  }
}

// axe-core leaves with the audit.
export function auditDone(): void {
  const state = (window as unknown as { __haunt?: { axe?: unknown } }).__haunt;
  if (state) state.axe = undefined;
}
