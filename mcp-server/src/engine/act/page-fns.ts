// mcp-server/src/engine/act/page-fns.ts
//
// Functions that run inside the page on behalf of an action. Like the ones in
// snapshot/page-script.ts they are serialised with toString(), so each is
// self-contained and reads the state installHooks() left on window.__haunt.

interface PageState {
  doc: string;
  roots: WeakMap<Element, ShadowRoot>;
  ids: WeakMap<Node, number>;
  nodes: Map<number, WeakRef<Node>>;
  next: number;
  native: {
    setTimeout: typeof window.setTimeout;
    clearTimeout: typeof window.clearTimeout;
  };
  timers: Map<number, { at: number; delay: number; repeat: boolean }>;
  later?: Map<number, number>;
  lastMutation: number;
  // Main-thread time taken by the engine's own scripts (page-script.ts).
  work?: Array<[number, number]>;
}

// How many one-shot timers set at or after `since` have yet to run: what a
// session that is ending still has to wait for.
export function pendingTimers(since: number): number {
  const state = (window as unknown as { __haunt?: PageState }).__haunt;
  if (!state) return 0;
  let count = 0;
  for (const timer of state.timers.values()) {
    if (!timer.repeat && timer.at >= since) count++;
  }
  for (const at of state.later?.values() ?? []) {
    if (at >= since) count++;
  }
  return count;
}

// The DOM node behind a reference, or null when that node is gone.
export function locate(target: { doc: string; local: number }): Element | null {
  const state = (window as unknown as { __haunt?: PageState }).__haunt;
  if (!state || state.doc !== target.doc) return null;
  const node = state.nodes.get(target.local)?.deref();
  return node instanceof Element && node.isConnected ? node : null;
}

export interface Probe {
  connected: boolean;
  tag: string;
  role: string;
  input_type?: string;
  hidden?: 'display' | 'visibility' | 'zero_size';
  disabled: boolean;
  readonly: boolean;
  // What kind of text entry it accepts, if any.
  editable: 'value' | 'content' | 'none';
  ignores_pointer: boolean;
  // False while its box is still moving.
  stable: boolean;
  // Local id of the element that would take a click aimed at this one.
  covered_by?: number;
  checked?: boolean;
  // Its centre, in the coordinates of its own frame's viewport.
  x?: number;
  y?: number;
}

// Everything that decides whether an element can take an action right now.
// Scrolls it into view first, the way a user would have to.
export async function probe(
  el: Element,
  // Bring it to the middle of the view instead of just into it: the second
  // try, when the nearest position left it under something (a sticky bar).
  centre = false,
): Promise<Probe> {
  const state = (window as unknown as { __haunt: PageState }).__haunt;
  // Scrolling a large page and reading its layout holds the main thread:
  // the engine's doing, not to be reported as the page's long task.
  const began = performance.now();
  try {
    return await look();
  } finally {
    state.work?.push([began, performance.now()]);
  }

  async function look(): Promise<Probe> {
    const idOf = (node: Node): number => {
      let id = state.ids.get(node);
      if (!id) {
        id = state.next++;
        state.ids.set(node, id);
        state.nodes.set(id, new WeakRef(node));
      }
      return id;
    };
    const shadowOf = (e: Element) => e.shadowRoot ?? state.roots.get(e) ?? null;
    const parentOf = (node: Node): Element | null => {
      if (node.parentElement) return node.parentElement;
      const root = node.getRootNode();
      return root instanceof ShadowRoot ? root.host : null;
    };
    const contains = (outer: Element, inner: Element | null) => {
      for (let n: Element | null = inner; n; n = parentOf(n))
        if (n === outer) return true;
      return false;
    };

    const html = el as HTMLElement;
    const input = el as HTMLInputElement;
    const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0];
    const role =
      explicit ??
      (el.tagName === 'BUTTON'
        ? 'button'
        : el.tagName === 'A'
          ? 'link'
          : el.tagName === 'SELECT'
            ? 'combobox'
            : el.tagName === 'INPUT' ||
                el.tagName === 'TEXTAREA' ||
                html.isContentEditable
              ? 'textbox'
              : 'generic');

    const result: Probe = {
      connected: el.isConnected,
      tag: el.tagName.toLowerCase(),
      role,
      input_type: el.tagName === 'INPUT' ? input.type : undefined,
      disabled:
        el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
      readonly: Boolean(input.readOnly),
      editable: 'none',
      ignores_pointer: false,
      stable: true,
    };
    if (!result.connected) return result;

    if (el.tagName === 'TEXTAREA') result.editable = 'value';
    else if (el.tagName === 'INPUT') {
      result.editable = [
        'checkbox',
        'radio',
        'file',
        'button',
        'submit',
        'reset',
        'image',
        'hidden',
      ].includes(input.type)
        ? 'none'
        : 'value';
    } else if (html.isContentEditable) result.editable = 'content';

    if (
      el.tagName === 'INPUT' &&
      (input.type === 'checkbox' || input.type === 'radio')
    ) {
      result.checked = input.checked;
    } else if (el.hasAttribute('aria-checked')) {
      result.checked = el.getAttribute('aria-checked') === 'true';
    }

    const style = getComputedStyle(el);
    if (el.getClientRects().length === 0) result.hidden = 'display';
    else if (style.visibility !== 'visible') result.hidden = 'visibility';
    else {
      const size = el.getBoundingClientRect();
      if (size.width === 0 || size.height === 0) result.hidden = 'zero_size';
    }
    if (result.hidden) return result;

    // Into view, only if it is not already: scrolling a page for nothing moves
    // things from under the pointer (and closes hover menus).
    const visibleIn = (rect: DOMRect) => {
      if (
        rect.top < 0 ||
        rect.left < 0 ||
        rect.bottom > innerHeight ||
        rect.right > innerWidth
      )
        return false;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (
        let n = parentOf(el);
        n && n !== document.body && n !== document.documentElement;
        n = parentOf(n)
      ) {
        const s = getComputedStyle(n);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const box = n.getBoundingClientRect();
        if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom)
          return false;
      }
      return true;
    };
    if (!visibleIn(el.getBoundingClientRect())) {
      // The least scrolling that shows it. Centring would also scroll its own
      // container, and a virtualised list rebuilds its rows when that happens.
      const where = centre ? 'center' : 'nearest';
      el.scrollIntoView({
        block: where,
        inline: where,
        behavior: 'instant' as ScrollBehavior,
      });
    }

    const before = el.getBoundingClientRect();
    // One frame later, has it moved? Two frames when something in the document
    // is being animated, since an animation's first frame can leave it where
    // it was. A frame that never comes (a hidden tab) must not hang the action.
    const frames = document.getAnimations().length > 0 ? 2 : 1;
    await new Promise<void>((resolve) => {
      let left = frames;
      const next = () =>
        --left <= 0 ? resolve() : requestAnimationFrame(next);
      requestAnimationFrame(next);
      (state.native?.setTimeout ?? setTimeout)(resolve, 150);
    });
    if (!el.isConnected) {
      result.connected = false;
      return result;
    }
    const rect = el.getBoundingClientRect();
    // Still, and not in the middle of a finite animation or transition of its
    // own or of something it sits in. Comparing positions alone can be fooled
    // when two frames land almost on top of each other on a busy machine.
    const animating = (() => {
      for (let n: Element | null = el; n; n = parentOf(n)) {
        for (const animation of n.getAnimations?.() ?? []) {
          const timing = animation.effect?.getComputedTiming();
          const finite = timing
            ? Number.isFinite(timing.endTime as number)
            : true;
          if (
            finite &&
            (animation.pending || animation.playState === 'running')
          ) {
            return true;
          }
        }
      }
      return false;
    })();
    result.stable =
      !animating &&
      Math.abs(rect.left - before.left) < 0.5 &&
      Math.abs(rect.top - before.top) < 0.5 &&
      Math.abs(rect.width - before.width) < 0.5 &&
      Math.abs(rect.height - before.height) < 0.5;

    result.x = rect.left + rect.width / 2;
    result.y = rect.top + rect.height / 2;
    if (style.pointerEvents === 'none') {
      result.ignores_pointer = true;
      return result;
    }

    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
    const y = Math.min(
      Math.max(rect.top + rect.height / 2, 0),
      innerHeight - 1,
    );
    result.x = rect.left + rect.width / 2;
    result.y = rect.top + rect.height / 2;
    let top = document.elementFromPoint(x, y);
    for (;;) {
      const inner: Element | null | undefined = top
        ? shadowOf(top)?.elementFromPoint(x, y)
        : null;
      if (!inner || inner === top) break;
      top = inner;
    }
    if (top && top !== el && !contains(el, top) && !contains(top, el)) {
      const label = top.closest('label') as HTMLLabelElement | null;
      if (!(label && label.control === el)) result.covered_by = idOf(top);
    }
    return result;
  }
}

export interface Quiet {
  quiet: boolean;
  ready: boolean;
  // Timers the page started since `since` that have not run out.
  timers: string[];
}

// Resolves when the document has stopped reacting — no mutation for
// `quietMs`, no short timer started since `since` still pending — or after
// `maxMs`, whichever comes first.
export function waitQuiet(args: {
  // Timers started at or after this moment count as the page reacting.
  since: number;
  // The DOM must have been still since at least this moment.
  from: number;
  quietMs: number;
  maxMs: number;
  // The page was already changing by itself before the action: its DOM
  // going quiet says nothing about the action, so it is not waited for.
  ignoreMutations: boolean;
}): Promise<Quiet> {
  const state = (window as unknown as { __haunt?: PageState }).__haunt;
  const read = (): Quiet => {
    if (!state)
      return {
        quiet: true,
        ready: document.readyState === 'complete',
        timers: [],
      };
    const timers: string[] = [];
    for (const timer of state.timers.values()) {
      if (timer.at >= args.since) {
        timers.push(`${timer.repeat ? 'interval' : 'timer'}(${timer.delay}ms)`);
      }
    }
    const still =
      args.ignoreMutations ||
      Date.now() - Math.max(state.lastMutation, args.from) >= args.quietMs;
    const ready = document.readyState === 'complete';
    return { quiet: still && ready && timers.length === 0, ready, timers };
  };
  const wait = state?.native.setTimeout ?? window.setTimeout.bind(window);
  return new Promise((resolve) => {
    const deadline = Date.now() + args.maxMs;
    const tick = () => {
      const now = read();
      if (now.quiet || Date.now() >= deadline) resolve(now);
      else wait(tick, 15);
    };
    // Observers (intersection, resize) report after the next frame is drawn:
    // look only once that has happened, or the page is judged before it has
    // had a chance to react. A hidden tab draws no frames, hence the timer.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      tick();
    };
    requestAnimationFrame(() => requestAnimationFrame(start));
    wait(start, 100);
  });
}

// Whether what is typed into this element is a credential, by the rule the
// snapshot uses to show such a field as "(filled)" (snapshot/page-script.ts,
// isCredential; repeated here because a page function cannot import).
export function credentialField(el: Element | null): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === 'password' || el.type === 'email') return true;
  if (/password|one-time-code|cc-number|cc-csc/.test(el.autocomplete || ''))
    return true;
  const labels = [...(el.labels ?? [])].map((l) => l.textContent ?? '');
  const name = [
    el.getAttribute('aria-label') ?? '',
    ...labels,
    el.placeholder,
    el.name,
    el.id,
  ].join(' ');
  return /pass(word|code|phrase)?|pwd|secret|\bpin\b|e-?mail/i.test(name);
}

// Whether what is typed into this element is a password: what makes a
// request that is refused a refused sign-in (signals, R-S14). An address is
// a credential too, but a form can be refused for one without any sign-in.
export function passwordField(el: Element | null): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === 'password') return true;
  if (/password/.test(el.autocomplete || '')) return true;
  const labels = [...(el.labels ?? [])].map((l) => l.textContent ?? '');
  const name = [
    el.getAttribute('aria-label') ?? '',
    ...labels,
    el.placeholder,
    el.name,
    el.id,
  ].join(' ');
  return /pass(word|code|phrase)?|pwd/i.test(name);
}

// The focused element, across shadow roots.
export function focusedElement(): Element | null {
  let active: Element | null = document.activeElement;
  for (;;) {
    const inner = active?.shadowRoot?.activeElement;
    if (!inner) return active;
    active = inner;
  }
}

// Whether the page did anything since `since` (epoch ms): changed its DOM,
// even to what it already showed (a status line set to the same text), or
// stopped a timer or an interval that was still to run.
export function reactedSince(since: number): boolean {
  const state = (
    window as unknown as {
      __haunt?: {
        lastCleared?: number;
        lastMutation?: number;
        lastInvalid?: number;
      };
    }
  ).__haunt;
  return (
    (state?.lastCleared ?? 0) >= since ||
    (state?.lastMutation ?? 0) >= since ||
    (state?.lastInvalid ?? 0) >= since
  );
}

// Milliseconds since this document last changed (a large number if never).
export function sinceMutation(): number {
  const state = (window as unknown as { __haunt?: PageState }).__haunt;
  return state?.lastMutation ? Date.now() - state.lastMutation : 1e9;
}

// Identifies the focused element, across shadow roots, so that two readings
// can be compared.
export function focusedId(): number {
  const state = (window as unknown as { __haunt?: PageState }).__haunt;
  let active: Element | null = document.activeElement;
  for (;;) {
    const root: ShadowRoot | null | undefined = active
      ? (active.shadowRoot ?? state?.roots.get(active))
      : null;
    const inner = root?.activeElement;
    if (!inner) break;
    active = inner;
  }
  if (!active || active === document.body || !state) return 0;
  let id = state.ids.get(active);
  if (!id) {
    id = state.next++;
    state.ids.set(active, id);
    state.nodes.set(id, new WeakRef(active));
  }
  return id;
}

// A file input that goes with this element: itself, one inside it, the one
// its label points to, or the only one near it.
export function fileInputFor(el: Element): Element | null {
  const isFile = (n: Element | null): n is HTMLInputElement =>
    n instanceof HTMLInputElement && n.type === 'file';
  if (isFile(el)) return el;
  const inside = el.querySelector('input[type=file]');
  if (inside) return inside;
  if (el instanceof HTMLLabelElement && isFile(el.control)) return el.control;
  let scope: Element | null = el.parentElement;
  for (
    let depth = 0;
    scope && depth < 2;
    depth++, scope = scope.parentElement
  ) {
    const near = scope.querySelectorAll('input[type=file]');
    if (near.length === 1) return near[0];
    if (near.length > 1) return null;
  }
  return null;
}

export interface OptionInfo {
  label: string;
  value: string;
  selected: boolean;
  disabled: boolean;
}

// The options of a native select, or of an ARIA listbox it owns or controls.
export function listOptions(el: Element): OptionInfo[] | null {
  const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
  if (el instanceof HTMLSelectElement) {
    return [...el.options].map((o) => ({
      label: squash(o.label || o.text),
      value: o.value,
      selected: o.selected,
      disabled: o.disabled,
    }));
  }
  const root = el.getRootNode() as Document | ShadowRoot;
  const controlled = (
    el.getAttribute('aria-controls') ??
    el.getAttribute('aria-owns') ??
    ''
  )
    .split(/\s+/)
    .map((id) => (id ? root.getElementById(id) : null))
    .filter((n): n is HTMLElement => n !== null);
  const scopes = [el, ...controlled];
  const options = scopes.flatMap((scope) => [
    ...scope.querySelectorAll('[role=option]'),
  ]);
  if (options.length === 0 && el.getAttribute('role') !== 'listbox')
    return null;
  return options.map((o) => ({
    label: squash(o.textContent ?? ''),
    value: o.getAttribute('data-value') ?? squash(o.textContent ?? ''),
    selected: o.getAttribute('aria-selected') === 'true',
    disabled: o.getAttribute('aria-disabled') === 'true',
  }));
}

// Whether `text` is somewhere a reader can see it in this document.
export function hasText(text: string): boolean {
  const state = (window as unknown as { __haunt?: PageState }).__haunt;
  const needle = text.replace(/\s+/g, ' ').trim();
  const seen = (root: Document | ShadowRoot | Element): boolean => {
    const body = root instanceof Document ? root.body : root;
    if (!body) return false;
    const own = (body as HTMLElement).innerText ?? body.textContent ?? '';
    if (own.replace(/\s+/g, ' ').includes(needle)) return true;
    for (const el of body.querySelectorAll('*')) {
      const shadow = el.shadowRoot ?? state?.roots.get(el);
      if (shadow && seen(shadow)) return true;
    }
    return false;
  };
  return seen(document);
}

// Scrolls the first element whose own text contains `text` into view.
export function scrollToText(text: string): boolean {
  const needle = text.replace(/\s+/g, ' ').trim();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      (node.nodeValue ?? '').replace(/\s+/g, ' ').includes(needle) &&
      node.parentElement
    ) {
      const el = node.parentElement;
      if (el.getClientRects().length === 0) continue;
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'instant' as ScrollBehavior,
      });
      return true;
    }
  }
  return false;
}

// Scrolls a container (or the page) by an amount, defaulting to one "page".
export function scrollBy(
  el: Element | null,
  args: { direction: 'up' | 'down' | 'left' | 'right'; amount?: number },
): void {
  let target: Element | null = el;
  // An element that does not scroll itself scrolls its nearest scroller.
  while (
    target &&
    target !== document.body &&
    target !== document.documentElement
  ) {
    const s = getComputedStyle(target);
    const can =
      (/(auto|scroll)/.test(s.overflowY) &&
        target.scrollHeight > target.clientHeight) ||
      (/(auto|scroll)/.test(s.overflowX) &&
        target.scrollWidth > target.clientWidth);
    if (can) break;
    target = target.parentElement;
  }
  const page =
    !target || target === document.body || target === document.documentElement;
  const horizontal = args.direction === 'left' || args.direction === 'right';
  const size = page
    ? horizontal
      ? innerWidth
      : innerHeight
    : horizontal
      ? (target as Element).clientWidth
      : (target as Element).clientHeight;
  const distance =
    (args.amount ?? size) *
    (args.direction === 'up' || args.direction === 'left' ? -1 : 1);
  const options = {
    left: horizontal ? distance : 0,
    top: horizontal ? 0 : distance,
    behavior: 'instant' as ScrollBehavior,
  };
  if (page) window.scrollBy(options);
  else (target as Element).scrollBy(options);
}
