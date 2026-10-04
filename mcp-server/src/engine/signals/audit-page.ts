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
}): Promise<Array<{
  rule: string;
  impact: string;
  help: string;
  nodes: number;
  elements: Array<[string, number]>;
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
    const results = await axe.run(document, {
      ...args.options,
      iframes: false,
      elementRef: true,
      rules,
    });
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
