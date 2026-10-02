// mcp-server/src/engine/snapshot/page-script.ts
//
// The two functions that run inside the page. Playwright serialises them with
// toString(), so each must be self-contained: no imports, no references to
// anything outside its own body.

export interface RawElement {
  // Stable for as long as the DOM node lives; unique within its document.
  local: number;
  role: string;
  name: string;
  tag: string;
  // Local ids of the shadow roots it sits in, outermost first.
  shadow: number[];
  value?: string;
  placeholder?: string;
  input_type?: string;
  href?: string;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  required?: boolean;
  invalid?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  offscreen?: boolean;
  // Local id of whatever would receive a click aimed at this element.
  covered_by?: number;
  unclickable?: 'pointer_events';
  hidden?: 'display' | 'visibility' | 'zero_size';
  scroll?: { x: number; y: number; max_x: number; max_y: number };
  attributes?: Record<string, string>;
}

// In document order: what a reader meets, element or text.
export type RawItem = { el: number } | { text: string; heading?: number };

export interface RawSnapshot {
  // Identifies this document: a navigation gives a new one.
  doc: string;
  elements: RawElement[];
  items: RawItem[];
  shadows: Array<{ local: number; mode: 'open' | 'closed'; parents: number[] }>;
  scroll: { x: number; y: number; max_x: number; max_y: number };
}

export interface CollectOptions {
  attributes: string[];
  // Deliberate breakages, for the gate's own tests (engine/sabotage.ts).
  sabotage?: 'closed_shadow_dropped' | 'redaction_by_label_only';
  // Restrict to the subtree of the element with this local id.
  within?: number;
}

// Installed before any page script runs.
//
// - Closed shadow roots cannot be reached from outside once created, so they
//   are remembered as they are made.
// - Short timers and DOM mutations are tracked, so that after an action the
//   engine can tell a page that has finished reacting from one that has not.
export function installHooks(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w.__haunt) return;

  const native = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  };
  const state = {
    doc: Math.random().toString(36).slice(2),
    roots: new WeakMap<Element, ShadowRoot>(),
    ids: new WeakMap<Node, number>(),
    nodes: new Map<number, WeakRef<Node>>(),
    next: 1,
    native,
    // Pending timers short enough to be "the page still reacting".
    timers: new Map<number, { at: number; delay: number; repeat: boolean }>(),
    lastMutation: 0,
  };
  Object.defineProperty(window, '__haunt', { value: state, enumerable: false });

  const observer = new MutationObserver(() => {
    state.lastMutation = Date.now();
  });
  const watch = (root: Node) =>
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  watch(document);

  const original = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (
    this: Element,
    init: ShadowRootInit,
  ) {
    const root = original.call(this, init);
    state.roots.set(this, root);
    watch(root);
    return root;
  };

  const SHORT_MS = 2_000;
  // biome-ignore lint/suspicious/noExplicitAny: mirrors the DOM signatures
  type Handler = any;
  window.setTimeout = ((
    handler: Handler,
    delay?: number,
    ...args: unknown[]
  ) => {
    const ms = Number(delay) || 0;
    let id = 0;
    const run =
      typeof handler === 'function'
        ? function (this: unknown, ...inner: unknown[]) {
            state.timers.delete(id);
            return handler.apply(this, inner);
          }
        : handler;
    id = native.setTimeout(run, delay, ...args) as unknown as number;
    if (ms <= SHORT_MS) {
      state.timers.set(id, { at: Date.now(), delay: ms, repeat: false });
      // A string handler cannot be wrapped; forget it once it is due.
      if (typeof handler !== 'function') {
        native.setTimeout(() => state.timers.delete(id), ms + 1);
      }
    }
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined) state.timers.delete(id);
    return native.clearTimeout(id);
  }) as typeof window.clearTimeout;
  window.setInterval = ((
    handler: Handler,
    delay?: number,
    ...args: unknown[]
  ) => {
    const ms = Number(delay) || 0;
    const id = native.setInterval(handler, delay, ...args) as unknown as number;
    if (ms <= SHORT_MS) {
      state.timers.set(id, { at: Date.now(), delay: ms, repeat: true });
    }
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => {
    if (id !== undefined) state.timers.delete(id);
    return native.clearInterval(id);
  }) as typeof window.clearInterval;
}

// Returns the RawSnapshot as a JSON string: handing Playwright one string
// instead of tens of thousands of small objects is several times faster.
export function collect(options: CollectOptions): string {
  interface State {
    doc: string;
    roots: WeakMap<Element, ShadowRoot>;
    ids: WeakMap<Node, number>;
    nodes: Map<number, WeakRef<Node>>;
    next: number;
  }
  let state = (window as unknown as { __haunt?: State }).__haunt;
  if (!state) {
    // The hooks were not installed in time (should not happen); closed roots
    // created before this point are out of reach.
    state = {
      doc: Math.random().toString(36).slice(2),
      roots: new WeakMap(),
      ids: new WeakMap(),
      nodes: new Map(),
      next: 1,
    };
    Object.defineProperty(window, '__haunt', {
      value: state,
      enumerable: false,
    });
  }
  const st = state;

  const idOf = (node: Node): number => {
    let id = st.ids.get(node);
    if (!id) {
      id = st.next++;
      st.ids.set(node, id);
      st.nodes.set(id, new WeakRef(node));
    }
    return id;
  };
  const shadowOf = (el: Element): ShadowRoot | null =>
    el.shadowRoot ??
    (options.sabotage === 'closed_shadow_dropped'
      ? null
      : (st.roots.get(el) ?? null));

  const INTERACTIVE_ROLES = new Set([
    'button',
    'link',
    'checkbox',
    'radio',
    'switch',
    'textbox',
    'searchbox',
    'combobox',
    'slider',
    'spinbutton',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'tab',
    'treeitem',
    'separator',
    'scrollbar',
  ]);
  const INTERACTIVE_CURSORS = new Set([
    'pointer',
    'grab',
    'grabbing',
    'move',
    'ew-resize',
    'ns-resize',
    'col-resize',
    'row-resize',
    'nesw-resize',
    'nwse-resize',
  ]);
  const SKIPPED_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'HEAD',
    'META',
    'LINK',
    'TITLE',
    'OPTION',
    'OPTGROUP',
  ]);
  const HEADINGS: Record<string, number> = {
    H1: 1,
    H2: 2,
    H3: 3,
    H4: 4,
    H5: 5,
    H6: 6,
  };

  const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
  const styleCache = new Map<Element, CSSStyleDeclaration>();
  const styleOf = (el: Element) => {
    let style = styleCache.get(el);
    if (!style) {
      style = getComputedStyle(el);
      styleCache.set(el, style);
    }
    return style;
  };
  const parentOf = (node: Node): Element | null => {
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  };

  // Text a user can see inside an element, skipping what is not rendered.
  const visibleText = (root: Element): string => {
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue ?? '');
        return;
      }
      if (!(node instanceof Element)) return;
      if (SKIPPED_TAGS.has(node.tagName)) return;
      if (node.getAttribute('aria-hidden') === 'true') return;
      if (node !== root) {
        const style = styleOf(node);
        if (style.display === 'none' || style.visibility === 'hidden') return;
      }
      if (node instanceof HTMLImageElement && node.alt) parts.push(node.alt);
      for (const child of node.childNodes) walk(child);
    };
    walk(root);
    return squash(parts.join(' '));
  };

  const roleOf = (el: Element): string => {
    const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0];
    if (explicit) return explicit;
    const tag = el.tagName;
    if (tag === 'A') return el.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'BUTTON' || tag === 'SUMMARY') return 'button';
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'SELECT') {
      const select = el as HTMLSelectElement;
      return select.multiple || select.size > 1 ? 'listbox' : 'combobox';
    }
    if (tag === 'INPUT') {
      const type = (el as HTMLInputElement).type;
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'search') return 'searchbox';
      if (
        ['button', 'submit', 'reset', 'image', 'file', 'color'].includes(type)
      )
        return 'button';
      return 'textbox';
    }
    if ((el as HTMLElement).isContentEditable) return 'textbox';
    return 'generic';
  };

  const nameOf = (el: Element, role: string): string => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const root = el.getRootNode() as Document | ShadowRoot;
      const text = labelledBy
        .split(/\s+/)
        .map((id) => root.getElementById(id))
        .filter((n): n is HTMLElement => n !== null)
        .map((n) => visibleText(n) || squash(n.textContent ?? ''))
        .join(' ');
      if (squash(text)) return squash(text);
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && squash(ariaLabel)) return squash(ariaLabel);

    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length > 0) {
      const text = [...labels]
        .map((label) => {
          const clone = label.cloneNode(true) as HTMLElement;
          for (const control of clone.querySelectorAll(
            'input, select, textarea, button',
          )) {
            control.remove();
          }
          return squash(clone.textContent ?? '');
        })
        .join(' ');
      if (squash(text)) return squash(text);
    }

    if (el instanceof HTMLInputElement) {
      if (['button', 'submit', 'reset'].includes(el.type) && el.value)
        return squash(el.value);
      if (el.type === 'image' && el.alt) return squash(el.alt);
    }
    if (el instanceof HTMLImageElement && el.alt) return squash(el.alt);

    const fromContent =
      ![
        'textbox',
        'searchbox',
        'combobox',
        'listbox',
        'spinbutton',
        'slider',
      ].includes(role) && !(role === 'generic' && isScrollable(el));
    if (
      fromContent &&
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      const text = visibleText(el);
      if (text) return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    }
    const title = el.getAttribute('title');
    if (title && squash(title)) return squash(title);
    const placeholder = el.getAttribute('placeholder');
    return placeholder ? squash(placeholder) : '';
  };

  const scrolls = (v: string) => v === 'auto' || v === 'scroll';
  const isScrollable = (el: Element): boolean => {
    if (el === document.documentElement || el === document.body) return false;
    // The style is cached and almost always says no; only then are the
    // scroll sizes read, which is what costs on a large page.
    const style = styleOf(el);
    const vertical = scrolls(style.overflowY);
    const horizontal = scrolls(style.overflowX);
    if (!vertical && !horizontal) return false;
    return (
      (vertical && el.scrollHeight - el.clientHeight >= 1) ||
      (horizontal && el.scrollWidth - el.clientWidth >= 1)
    );
  };

  const isActionable = (el: Element): boolean => {
    const tag = el.tagName;
    if (SKIPPED_TAGS.has(tag)) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (tag === 'INPUT') return (el as HTMLInputElement).type !== 'hidden';
    if (
      tag === 'BUTTON' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA' ||
      tag === 'SUMMARY'
    )
      return true;
    if (tag === 'A') return el.hasAttribute('href');
    const role = el.getAttribute('role')?.trim().split(/\s+/)[0];
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    if (
      el.hasAttribute('contenteditable') &&
      el.getAttribute('contenteditable') !== 'false'
    )
      return true;
    if (el.hasAttribute('onclick')) return true;
    if (el.getAttribute('draggable') === 'true') return true;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && Number(tabindex) >= 0) return true;
    if (tag === 'IFRAME' || tag === 'HTML' || tag === 'BODY') return false;
    const cursor = styleOf(el).cursor;
    if (INTERACTIVE_CURSORS.has(cursor)) {
      // Only where the cursor is set, not on everything that inherits it.
      const parent = parentOf(el);
      if (!parent || styleOf(parent).cursor !== cursor) return true;
    }
    return isScrollable(el);
  };

  const CREDENTIAL = /pass(word|code|phrase)?|pwd|secret|\bpin\b|e-?mail/i;
  const isCredential = (el: Element, name: string): boolean => {
    if (!(el instanceof HTMLInputElement)) return false;
    if (options.sabotage === 'redaction_by_label_only') {
      return CREDENTIAL.test(name);
    }
    if (el.type === 'password' || el.type === 'email') return true;
    if (/password|one-time-code|cc-number|cc-csc/.test(el.autocomplete || ''))
      return true;
    return CREDENTIAL.test(`${name} ${el.name} ${el.id}`);
  };

  // The element that would receive a pointer event at (x, y), through every
  // shadow root on the way down.
  const topElementAt = (x: number, y: number): Element | null => {
    let el = document.elementFromPoint(x, y);
    for (;;) {
      const root = el ? shadowOf(el) : null;
      const inner = root?.elementFromPoint(x, y);
      if (!inner || inner === el) return el;
      el = inner;
    }
  };
  const contains = (outer: Element, inner: Element | null): boolean => {
    for (let node: Element | null = inner; node; node = parentOf(node)) {
      if (node === outer) return true;
    }
    return false;
  };

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const clippedOut = (el: Element, rect: DOMRect): boolean => {
    if (
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= viewport.height ||
      rect.left >= viewport.width
    ) {
      return true;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let node = parentOf(el); node; node = parentOf(node)) {
      if (node === document.documentElement || node === document.body) break;
      const style = styleOf(node);
      if (style.overflowX === 'visible' && style.overflowY === 'visible')
        continue;
      const box = node.getBoundingClientRect();
      if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom)
        return true;
    }
    return false;
  };

  const elements: RawElement[] = [];
  const items: RawItem[] = [];
  const shadows: RawSnapshot['shadows'] = [];
  const indexByNode = new Map<Element, number>();
  // Elements that are only listed because they cover something.
  const pendingCovers: Array<{
    target: RawElement;
    cover: Element;
    shadow: number[];
  }> = [];

  const describe = (el: Element, shadow: number[]): RawElement => {
    const role = roleOf(el);
    const name = nameOf(el, role);
    const raw: RawElement = {
      local: idOf(el),
      role,
      name,
      tag: el.tagName.toLowerCase(),
      shadow,
    };
    const html = el as HTMLElement;

    if (el instanceof HTMLInputElement) {
      raw.input_type = el.type;
      if (el.type === 'checkbox' || el.type === 'radio')
        raw.checked = el.checked;
      else if (el.type !== 'file') {
        if (isCredential(el, name)) {
          if (el.value) raw.value = '(filled)';
        } else if (el.value !== '') raw.value = el.value;
      }
      if (el.placeholder) raw.placeholder = el.placeholder;
      if (el.readOnly) raw.readonly = true;
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.value !== '') raw.value = el.value;
      if (el.placeholder) raw.placeholder = el.placeholder;
      if (el.readOnly) raw.readonly = true;
    } else if (el instanceof HTMLSelectElement) {
      const chosen = [...el.selectedOptions].map((o) =>
        squash(o.label || o.text),
      );
      if (chosen.length > 0) raw.value = chosen.join(', ');
    } else if (el.hasAttribute('aria-valuenow')) {
      raw.value = el.getAttribute('aria-valuenow') ?? undefined;
    } else if (html.isContentEditable) {
      const text = squash(html.innerText ?? '');
      if (text) raw.value = text;
    }
    if (el instanceof HTMLAnchorElement && el.hasAttribute('href'))
      raw.href = el.href;

    const aria = (attribute: string): boolean | undefined => {
      const v = el.getAttribute(attribute);
      return v === 'true' ? true : v === 'false' ? false : undefined;
    };
    if (raw.checked === undefined) raw.checked = aria('aria-checked');
    raw.selected = aria('aria-selected');
    raw.expanded = aria('aria-expanded');
    raw.pressed = aria('aria-pressed');
    if ((el as HTMLInputElement).required || aria('aria-required'))
      raw.required = true;
    if (aria('aria-invalid')) raw.invalid = true;
    if (el.matches(':disabled') || aria('aria-disabled')) raw.disabled = true;

    // Visibility
    const style = styleOf(el);
    const rect = el.getBoundingClientRect();
    if (el.getClientRects().length === 0) raw.hidden = 'display';
    else if (style.visibility !== 'visible') raw.hidden = 'visibility';
    else if (rect.width === 0 || rect.height === 0) raw.hidden = 'zero_size';

    if (!raw.hidden) {
      if (clippedOut(el, rect)) raw.offscreen = true;
      else if (style.pointerEvents === 'none')
        raw.unclickable = 'pointer_events';
      else {
        const x = Math.min(
          Math.max(rect.left + rect.width / 2, 0),
          viewport.width - 1,
        );
        const y = Math.min(
          Math.max(rect.top + rect.height / 2, 0),
          viewport.height - 1,
        );
        const top = topElementAt(x, y);
        if (top && top !== el && !contains(el, top) && !contains(top, el)) {
          // A label in front of its own control is not a cover.
          const label = top.closest('label');
          const own = label && (label as HTMLLabelElement).control === el;
          if (!own) pendingCovers.push({ target: raw, cover: top, shadow });
        }
      }
    }

    if (isScrollable(el)) {
      raw.scroll = {
        x: el.scrollLeft,
        y: el.scrollTop,
        max_x: el.scrollWidth - el.clientWidth,
        max_y: el.scrollHeight - el.clientHeight,
      };
    }

    if (options.attributes.length > 0) {
      const attributes: Record<string, string> = {};
      for (const attribute of options.attributes) {
        const v = el.getAttribute(attribute);
        if (v !== null) attributes[attribute] = v;
      }
      if (Object.keys(attributes).length > 0) raw.attributes = attributes;
    }

    for (const key of Object.keys(raw) as Array<keyof RawElement>) {
      if (raw[key] === undefined) delete raw[key];
    }
    return raw;
  };

  const add = (el: Element, shadow: number[]): number => {
    const existing = indexByNode.get(el);
    if (existing !== undefined) return existing;
    const index = elements.length;
    indexByNode.set(el, index);
    elements.push(describe(el, shadow));
    return index;
  };

  // `rendered` is false inside a display:none subtree: elements there are
  // still listed (marked hidden), their text is not.
  const walk = (
    node: Node,
    shadow: number[],
    rendered: boolean,
    insideActionable: boolean,
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!rendered || insideActionable) return;
      const text = squash(node.nodeValue ?? '');
      if (!text) return;
      const parent = node.parentElement;
      const heading = parent ? HEADINGS[parent.tagName] : undefined;
      items.push(heading ? { text, heading } : { text });
      return;
    }
    if (!(node instanceof Element)) return;
    if (SKIPPED_TAGS.has(node.tagName)) return;

    let nowRendered = rendered;
    if (rendered) {
      const style = styleOf(node);
      if (style.display === 'none' || style.visibility === 'hidden')
        nowRendered = false;
      if (node.getAttribute('aria-hidden') === 'true') nowRendered = false;
    }

    const actionable = isActionable(node);
    // Text under a button or a link is its name; text under a mere container
    // (a scroll area, a draggable card) is still content to read.
    let swallow = insideActionable;
    if (actionable) {
      const index = add(node, shadow);
      items.push({ el: index });
      if (elements[index].role !== 'generic') swallow = true;
    }

    const root = shadowOf(node);
    if (root) {
      const local = idOf(root);
      shadows.push({ local, mode: root.mode, parents: shadow });
      for (const child of root.childNodes) {
        walk(child, [...shadow, local], nowRendered, swallow);
      }
    }
    // A select's options and a canvas's fallback content are still children.
    for (const child of node.childNodes) {
      walk(child, shadow, nowRendered, swallow);
    }
  };

  let start: Node = document.documentElement;
  let startShadow: number[] = [];
  if (options.within !== undefined) {
    const node = st.nodes.get(options.within)?.deref();
    if (node instanceof Element && node.isConnected) {
      start = node;
      const chain: number[] = [];
      for (
        let root = node.getRootNode();
        root instanceof ShadowRoot;
        root = root.host.getRootNode()
      ) {
        chain.unshift(idOf(root));
      }
      startShadow = chain;
    }
  }
  walk(start, startShadow, true, false);

  for (const { target, cover } of pendingCovers) {
    const chain: number[] = [];
    for (
      let root = cover.getRootNode();
      root instanceof ShadowRoot;
      root = root.host.getRootNode()
    ) {
      chain.unshift(idOf(root));
    }
    // The cover gets a reference of its own, so it can be named and acted on.
    const index = add(cover, chain);
    target.covered_by = elements[index].local;
    if (!items.some((item) => 'el' in item && item.el === index))
      items.push({ el: index });
  }

  const doc = document.documentElement;
  const result: RawSnapshot = {
    doc: st.doc,
    elements,
    items,
    shadows,
    scroll: {
      x: Math.round(window.scrollX),
      y: Math.round(window.scrollY),
      max_x: Math.max(0, doc.scrollWidth - window.innerWidth),
      max_y: Math.max(0, doc.scrollHeight - window.innerHeight),
    },
  };
  return JSON.stringify(result);
}
