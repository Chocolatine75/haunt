// mcp-server/src/engine/signals/layout-page.ts
//
// What is wrong with a page's layout that geometry alone can establish
// (part 5). Runs in the page, serialised with toString(): self-contained,
// no import, nothing referenced outside its own body. It reads boxes and
// asks what is at a point; it changes nothing (R-S17).
//
// Each rule is narrow on purpose. A sticky header over content that scrolls
// under it, a dialog over the page behind it, a title cut with an ellipsis,
// a list that scrolls: none of these is a defect, and a signal that fires
// on them would be noise in every report.

export interface LayoutIssue {
  rule:
    | 'covered'
    | 'overlap'
    | 'text_overflow'
    | 'dialog_outside_viewport'
    | 'page_overflow';
  // The control it is about, by its local id; absent for a rule about the
  // page or about text that is not a control's.
  local?: number;
  // The other control, when it is one.
  other?: number;
  // What it is about when that is not a control: a tag, its text.
  what?: string;
  // What covers it, or what it overflows, in a few words.
  by?: string;
  // By how much, in pixels.
  px?: number;
}

export function layoutIssues(input: {
  doc: string;
  locals: number[];
}): LayoutIssue[] {
  interface State {
    doc: string;
    nodes: Map<number, WeakRef<Node>>;
    work?: Array<[number, number]>;
  }
  const state = (window as unknown as { __haunt?: State }).__haunt;
  if (!state || state.doc !== input.doc) return [];
  const began = performance.now();
  const issues: LayoutIssue[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const root = document.documentElement;

  const say = (el: Element): string => {
    const text = (el.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    return text ? `${tag}${id} "${text}"` : `${tag}${id}`;
  };
  // What a control is called, near enough to tell two of the same.
  const called = (el: Element) =>
    (el.getAttribute('aria-label') || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  const shown = (el: Element): boolean => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0.05 &&
      box.width >= 4 &&
      box.height >= 4
    );
  };
  // The ancestor that pins an element to the viewport, if any: what tells
  // two things that move together when the page scrolls from two that do
  // not.
  const pinned = (el: Element): Element | null => {
    for (let at: Element | null = el; at; at = at.parentElement) {
      const position = getComputedStyle(at).position;
      if (position === 'fixed' || position === 'sticky') return at;
    }
    return null;
  };
  // Something that is meant to sit over the page: what the user opened, and
  // a message that shows for a moment and goes.
  const OVER =
    '[role="dialog"],[role="alertdialog"],dialog,[role="menu"],[role="listbox"],[role="tooltip"],[popover],[role="status"],[role="alert"],[aria-live]';
  // Across shadow roots: an element is inside its root's host, which
  // contains() does not say, and a point in a closed root answers with the
  // host.
  const inside = (inner: Node, outer: Node): boolean => {
    for (let at: Node | null = inner; at; ) {
      if (at === outer) return true;
      const parent: Node | null = at.parentNode;
      at = parent instanceof ShadowRoot ? parent.host : parent;
    }
    return false;
  };
  const within = (a: Node, b: Node) => inside(a, b) || inside(b, a);
  // The part of an element's box that its scrolling ancestors let through:
  // a row scrolled out of its list has a box, and nothing of it shows.
  const visibleBox = (el: Element): DOMRect | null => {
    const boxes = el.getClientRects();
    // An inline element that wraps has a box per line; its bounding box
    // spans lines it only touches the ends of.
    if (boxes.length !== 1) return null;
    let { left, top, right, bottom } = boxes[0];
    for (let at = el.parentElement; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.overflowX === 'visible' && style.overflowY === 'visible')
        continue;
      const clip = at.getBoundingClientRect();
      left = Math.max(left, clip.left);
      top = Math.max(top, clip.top);
      right = Math.min(right, clip.right);
      bottom = Math.min(bottom, clip.bottom);
    }
    if (right - left < 4 || bottom - top < 4) return null;
    return new DOMRect(left, top, right - left, bottom - top);
  };
  // A layer over the whole page: a backdrop, a modal built without the
  // role of one. It covers what is behind it on purpose.
  const pageScale = (el: Element): boolean => {
    for (let at: Element | null = el; at; at = at.parentElement) {
      const position = getComputedStyle(at).position;
      if (position !== 'fixed' && position !== 'absolute') continue;
      const box = at.getBoundingClientRect();
      const w = Math.min(box.right, vw) - Math.max(box.left, 0);
      const h = Math.min(box.bottom, vh) - Math.max(box.top, 0);
      if (w > 0 && h > 0 && (w * h) / (vw * vh) > 0.3) return true;
    }
    return false;
  };
  const scrollsY = root.scrollHeight > vh + 2;

  const controls: Array<{ local: number; el: Element; box: DOMRect }> = [];
  for (const local of input.locals) {
    const node = state.nodes.get(local)?.deref();
    if (!(node instanceof Element) || !node.isConnected) continue;
    if (!shown(node)) continue;
    if ((node as HTMLButtonElement).disabled) continue;
    const box = visibleBox(node);
    if (box) controls.push({ local, el: node, box });
  }

  // --- covered: a control whose centre another element takes, and that no
  // scrolling would uncover.
  const coveredBy = new Map<Element, Element>();
  for (const { local, el, box } of controls) {
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
    let top: Element | null = document.elementFromPoint(x, y);
    while (top?.shadowRoot) {
      const inner = top.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === top) break;
      top = inner;
    }
    if (!top || within(el, top)) continue;
    // A label over its own field, a control inside the one hit.
    if (top instanceof HTMLLabelElement && top.control === el) continue;
    // An overlay that the control is not part of covers the page on
    // purpose.
    const overlay = top.closest(OVER);
    if (overlay && !overlay.contains(el)) continue;
    if (pageScale(top)) continue;
    const a = pinned(el);
    const b = pinned(top);
    // Pinned together or flowing together, they stay as they are. One
    // pinned over one that flows is only a defect if the page cannot
    // scroll the other out from under it.
    if (a !== b && !(a && b) && scrollsY) continue;
    const other = controls.find((c) => c.el === top || c.el.contains(top));
    // Two of the same name on each other: pins on a map, by the dozen.
    if (other && called(other.el) !== '' && called(other.el) === called(el)) {
      continue;
    }
    coveredBy.set(el, top);
    issues.push({
      rule: 'covered',
      local,
      ...(other ? { other: other.local } : { by: say(top) }),
    });
  }

  // --- overlap: two controls whose boxes share half of the smaller.
  // Named controls only, and not two of the same name: pins on a map sit
  // on each other by the dozen, and a wrapper with no name is not something
  // a user aims at.
  const NAMED =
    /^(button|link|textbox|searchbox|checkbox|radio|combobox|tab|menuitem|switch|slider|spinbutton)$/;
  const label = (el: Element) =>
    (
      el.getAttribute('aria-label') ||
      (el as HTMLInputElement).placeholder ||
      el.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
  const roleOf = (el: Element) =>
    el.getAttribute('role') ||
    (
      {
        BUTTON: 'button',
        A: 'link',
        SELECT: 'combobox',
        TEXTAREA: 'textbox',
        INPUT: 'textbox',
      } as Record<string, string>
    )[el.tagName] ||
    '';
  const flat = controls.filter(
    (c) =>
      c.box.width * c.box.height < vw * vh * 0.5 &&
      NAMED.test(roleOf(c.el)) &&
      label(c.el) !== '',
  );
  for (let i = 0; i < flat.length && i < 400; i++) {
    for (let j = i + 1; j < flat.length && j < 400; j++) {
      const a = flat[i];
      const b = flat[j];
      if (within(a.el, b.el)) continue;
      if (label(a.el) === label(b.el)) continue;
      const w =
        Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const h =
        Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (w <= 0 || h <= 0) continue;
      const smaller = Math.min(
        a.box.width * a.box.height,
        b.box.width * b.box.height,
      );
      if ((w * h) / smaller < 0.5) continue;
      // Words in a line: their boxes touch and nobody sees them overlap.
      if (
        getComputedStyle(a.el).display === 'inline' ||
        getComputedStyle(b.el).display === 'inline'
      ) {
        continue;
      }
      if (coveredBy.get(a.el) === b.el || coveredBy.get(b.el) === a.el)
        continue;
      // One in an overlay over the other is the overlay doing its job.
      const oa = a.el.closest(OVER);
      const ob = b.el.closest(OVER);
      if (oa !== ob) continue;
      const pa = pinned(a.el);
      const pb = pinned(b.el);
      if (pa !== pb && !(pa && pb) && scrollsY) continue;
      issues.push({ rule: 'overlap', local: a.local, other: b.local });
    }
  }

  // --- text_overflow: text that leaves its box, or is cut by it without
  // an ellipsis to say so.
  const texts = document.querySelectorAll(
    'button, a, label, th, td, li, p, span, div, h1, h2, h3, h4, h5, h6, summary, legend, option',
  );
  let checked = 0;
  for (const el of texts) {
    if (checked >= 3_000) break;
    let own = '';
    for (const child of el.childNodes) {
      if (child.nodeType === 3) own += child.nodeValue ?? '';
    }
    own = own.replace(/\s+/g, ' ').trim();
    if (own.length < 2) continue;
    checked++;
    if (!shown(el) || el.closest('[aria-hidden="true"]')) continue;
    const style = getComputedStyle(el);
    if (style.display === 'inline' || style.display === 'contents') continue;
    const box = el.getBoundingClientRect();
    // The pattern that hides text from the eye and keeps it for a reader.
    if (box.width <= 2 || box.height <= 2) continue;
    const scrolls = (v: string) => v === 'auto' || v === 'scroll';
    if (scrolls(style.overflowX) || scrolls(style.overflowY)) continue;
    const cuts = (v: string) => v === 'hidden' || v === 'clip';
    // Its own text only: a menu item's submenu is positioned elsewhere and
    // is not this item's text leaving its box.
    let inked: { left: number; right: number; bottom: number } | undefined;
    for (const child of el.childNodes) {
      if (child.nodeType !== 3 || !(child.nodeValue ?? '').trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(child);
      const r = range.getBoundingClientRect();
      if (r.width === 0) continue;
      inked = inked
        ? {
            left: Math.min(inked.left, r.left),
            right: Math.max(inked.right, r.right),
            bottom: Math.max(inked.bottom, r.bottom),
          }
        : { left: r.left, right: r.right, bottom: r.bottom };
    }
    if (!inked) continue;
    const beyond = Math.max(inked.right - box.right, box.left - inked.left);
    const below = inked.bottom - box.bottom;
    if (cuts(style.overflowX) || cuts(style.overflowY)) {
      if (style.textOverflow === 'ellipsis') continue;
      // Text clamped to a number of lines is shortened on purpose, as with
      // an ellipsis; and so is a paragraph in a box of a fixed height, more
      // often than not. What is reported is a label a user needs whole: a
      // control's, or a heading's.
      const clamp = (style as unknown as { webkitLineClamp?: string })
        .webkitLineClamp;
      if (clamp && clamp !== 'none') continue;
      if (
        !controls.some((c) => c.el === el) &&
        !/^(H[1-6]|TH|LABEL|LEGEND|SUMMARY)$/.test(el.tagName)
      ) {
        continue;
      }
      const cut = Math.max(
        cuts(style.overflowX) ? el.scrollWidth - el.clientWidth : 0,
        cuts(style.overflowY) ? el.scrollHeight - el.clientHeight : 0,
      );
      if (cut > 3) {
        const control = controls.find((c) => c.el === el);
        issues.push({
          rule: 'text_overflow',
          ...(control ? { local: control.local } : { what: say(el) }),
          by: 'cut off',
          px: Math.round(cut),
        });
      }
      continue;
    }
    // Text spilling out matters where the box is one a reader sees: it has
    // a border or a background of its own.
    const boxed =
      (style.borderStyle !== 'none' &&
        Number.parseFloat(style.borderWidth) > 0) ||
      (style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        style.backgroundColor !== 'transparent');
    if (boxed && Math.max(beyond, below) > 3) {
      const control = controls.find((c) => c.el === el);
      issues.push({
        rule: 'text_overflow',
        ...(control ? { local: control.local } : { what: say(el) }),
        by: 'spills out',
        px: Math.round(Math.max(beyond, below)),
      });
    }
  }

  // --- dialog_outside_viewport: a modal that opened where the user is not
  // looking.
  for (const el of document.querySelectorAll(
    '[role="dialog"][aria-modal="true"], [role="alertdialog"], dialog[open]',
  )) {
    if (!shown(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.width > vw * 1.2 || box.height > vh * 1.5) continue;
    const w = Math.min(box.right, vw) - Math.max(box.left, 0);
    const h = Math.min(box.bottom, vh) - Math.max(box.top, 0);
    const visible = Math.max(0, w) * Math.max(0, h);
    if (visible / (box.width * box.height) < 0.6) {
      issues.push({ rule: 'dialog_outside_viewport', what: say(el) });
    }
  }

  // --- page_overflow: the page is wider than its window.
  const over = root.scrollWidth - vw;
  // On a narrow window only: on a wide one a page that scrolls sideways
  // is usually a wide table doing what it is for.
  if (vw <= 600 && over > 4 && getComputedStyle(root).overflowX !== 'hidden') {
    issues.push({ rule: 'page_overflow', px: Math.round(over) });
  }

  state.work?.push([began, performance.now()]);
  // A page with forty cards built the same way has one defect forty times:
  // the first few say it.
  const kept: LayoutIssue[] = [];
  const count: Record<string, number> = {};
  for (const issue of issues) {
    count[issue.rule] = (count[issue.rule] ?? 0) + 1;
    if (count[issue.rule] <= 5) kept.push(issue);
  }
  return kept;
}
