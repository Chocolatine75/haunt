// mcp-server/src/engine/snapshot/snapshot.ts
//
// Builds the page snapshot a tester decides from: every actionable element
// with a stable reference, in reading order with the surrounding text, across
// frames and shadow roots. The shape is fixed by gates/part-1/contract.ts.
import type { Frame, Page } from 'playwright';
import type {
  CaptureInput,
  Snapshot,
  SnapshotContainer,
  SnapshotDiff,
  SnapshotElement,
} from '../../gates/part-1/contract.js';
import { currentSabotage } from '../sabotage.js';
import type { HauntSession } from '../types.js';
import { type RawElement, type RawSnapshot, collect } from './page-script.js';

// One page of the text format never exceeds this many characters.
export const SNAPSHOT_CHAR_BUDGET = 12_000;
const MAX_VALUE_CHARS = 200;
const MAX_TEXT_LINE_CHARS = 400;
const COLLECT_TIMEOUT_MS = 5_000;

export interface RefTarget {
  frame: Frame;
  doc: string;
  local: number;
}

// Everything a session remembers between snapshots.
export interface SnapshotState {
  nextRef: number;
  nextContainer: number;
  // "<frame>:<document>:<local id>" → reference. Never cleared: a reference
  // is issued once and never handed out again.
  refByKey: Map<string, string>;
  targets: Map<string, RefTarget>;
  frameIds: WeakMap<Frame, string>;
  shadowIds: Map<string, string>;
  // How many snapshots have been taken, and at which one each reference was
  // issued: tells an element that was rebuilt from one that was always there.
  seq: number;
  issuedAt: Map<string, number>;
  // Role, name and tag each reference was last seen with.
  described: Map<string, string>;
  previous?: {
    comparable: Map<string, string>;
    textHash: string;
    snapshot: Snapshot;
    elements: SnapshotElement[];
    containers: SnapshotContainer[];
    // The lines of the text format, kept so it can be rendered later.
    body: Line[];
    // When the page was read.
    at: number;
  };
  // A JavaScript dialog that is open and unanswered.
  dialog?: { type: string; message: string };
}

export function newSnapshotState(): SnapshotState {
  return {
    nextRef: 1,
    nextContainer: 1,
    refByKey: new Map(),
    targets: new Map(),
    frameIds: new WeakMap(),
    shadowIds: new Map(),
    seq: 0,
    issuedAt: new Map(),
    described: new Map(),
  };
}

type Line = { text: string; ref?: string };

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), ms),
    ),
  ]);
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const px = (n: number) => `${Math.round(n).toLocaleString('en-US')} px`;

// Fields that depend on where things are rather than on what they are. They
// are reported, but a change in them alone is not "the page changed".
function comparable(element: SnapshotElement): string {
  // Attributes are only there when a caller asked for them, so they would
  // make two snapshots of the same page look different.
  const {
    offscreen,
    covered_by,
    scroll,
    is_new,
    unclickable,
    attributes,
    ...rest
  } = element;
  return JSON.stringify(rest);
}

// What makes two elements "the same thing" to a tester.
function identity(element: SnapshotElement): string {
  return `${element.tag}|${element.role}|${element.name}`;
}

// What changed between an earlier state and a list of elements.
export function diffBetween(
  before: Map<string, string>,
  elements: SnapshotElement[],
): SnapshotDiff {
  const diff: SnapshotDiff = { added: [], removed: [], changed: [] };
  const now = new Set<string>();
  for (const element of elements) {
    now.add(element.ref);
    const was = before.get(element.ref);
    if (was === undefined) diff.added.push(element);
    else if (was !== comparable(element)) diff.changed.push(element);
  }
  for (const ref of before.keys()) if (!now.has(ref)) diff.removed.push(ref);
  return diff;
}

// The reference of an element known only by where it lives in its frame,
// issuing one if it has none yet.
export function refOfLocal(
  session: HauntSession,
  frame: Frame,
  doc: string,
  local: number,
): string {
  const state = session.snapshot;
  const id = frame === frame.page().mainFrame() ? '' : frameIdOf(state, frame);
  const key = `${id}:${doc}:${local}`;
  let ref = state.refByKey.get(key);
  if (!ref) {
    ref = `e${state.nextRef++}`;
    state.issuedAt.set(ref, state.seq);
    state.refByKey.set(key, ref);
    state.targets.set(ref, { frame, doc, local });
  }
  return ref;
}

// For a reference whose node is gone: the one element in the current page
// that is the same thing and did not exist when that reference was issued.
// An element that was already there (another "Delete" button) is not it.
export function similarTo(
  session: HauntSession,
  stale: string,
  current: SnapshotElement[],
): string | undefined {
  const state = session.snapshot;
  const wanted = state.described.get(stale);
  const since = state.issuedAt.get(stale) ?? 0;
  if (!wanted) return undefined;
  const candidates = current.filter(
    (e) =>
      e.ref !== stale &&
      identity(e) === wanted &&
      (state.issuedAt.get(e.ref) ?? 0) > since,
  );
  return candidates.length === 1 ? candidates[0].ref : undefined;
}

function elementLine(e: SnapshotElement, depth: number): string {
  const parts = [`${'  '.repeat(depth)}- ${e.role}`];
  if (e.name) parts.push(JSON.stringify(clip(e.name, MAX_VALUE_CHARS)));
  parts.push(`[${e.ref}]`);
  if (
    e.input_type &&
    !['text', 'checkbox', 'radio', 'range', 'number', 'search'].includes(
      e.input_type,
    )
  ) {
    parts.push(`type=${e.input_type}`);
  }
  if (e.value !== undefined)
    parts.push(`value=${JSON.stringify(clip(e.value, MAX_VALUE_CHARS))}`);
  if (e.placeholder && !e.value && e.placeholder !== e.name) {
    parts.push(
      `placeholder=${JSON.stringify(clip(e.placeholder, MAX_VALUE_CHARS))}`,
    );
  }
  if (e.checked) parts.push('checked');
  if (e.selected) parts.push('selected');
  if (e.expanded !== undefined)
    parts.push(e.expanded ? 'expanded' : 'collapsed');
  if (e.pressed) parts.push('pressed');
  if (e.required) parts.push('required');
  if (e.invalid) {
    parts.push(
      e.validation ? `invalid(${JSON.stringify(e.validation)})` : 'invalid',
    );
  }
  if (e.readonly) parts.push('readonly');
  if (e.disabled) parts.push('disabled');
  if (e.hidden) parts.push(`hidden(${e.hidden})`);
  if (e.covered_by) parts.push(`covered by ${e.covered_by}`);
  if (e.unclickable) parts.push('ignores the pointer');
  if (e.scroll) {
    const { y, max_y, x, max_x } = e.scroll;
    if (max_y > 0) parts.push(`scroll ${px(y)} above · ${px(max_y - y)} below`);
    if (max_x > 0) parts.push(`scroll ${px(x)} left · ${px(max_x - x)} right`);
  }
  if (e.href) {
    try {
      const url = new URL(e.href);
      // A same-page anchor says nothing a tester needs.
      if (!e.href.includes('#') || url.hash === '')
        parts.push(`-> ${url.pathname}${url.search}`);
    } catch {
      parts.push(`-> ${e.href}`);
    }
  }
  if (e.is_new) parts.push('new');
  return parts.join(' ');
}

function header(snapshot: Snapshot): string[] {
  const lines = [`Page: ${snapshot.title}`, `URL: ${snapshot.url}`];
  const { x, y, max_x, max_y } = snapshot.scroll;
  // A pixel or two of slack is not something a tester can scroll to.
  if (max_y > 4) lines.push(`Scroll: ${px(y)} above · ${px(max_y - y)} below`);
  if (max_x > 4) lines.push(`Scroll: ${px(x)} left · ${px(max_x - x)} right`);
  if (snapshot.tabs.length > 1) {
    lines.push('Tabs:');
    for (const tab of snapshot.tabs) {
      lines.push(
        `  ${tab.index}${tab.active ? ' (active)' : ''}: ${tab.title} — ${tab.url}`,
      );
    }
  }
  if (snapshot.dialog) {
    lines.push(
      `Dialog open (${snapshot.dialog.type}): ${JSON.stringify(snapshot.dialog.message)} — answer it before anything else.`,
    );
  }
  lines.push('');
  return lines;
}

// Splits the body into pages that each fit the budget with the header and a
// trailing notice, never cutting inside a line.
function paginate(head: string[], body: Line[]): Line[][] {
  const reserve = head.join('\n').length + 120;
  const room = Math.max(1_000, SNAPSHOT_CHAR_BUDGET - reserve);
  const pages: Line[][] = [[]];
  let used = 0;
  for (const line of body) {
    const cost = line.text.length + 1;
    if (used + cost > room && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(line);
    used += cost;
  }
  return pages;
}

async function tabsOf(session: HauntSession): Promise<Snapshot['tabs']> {
  const pages = session.page.context().pages();
  return Promise.all(
    pages.map(async (page, index) => ({
      index,
      title: (await withTimeout(page.title(), 500)) ?? '',
      url: page.url(),
      active: page === session.page,
    })),
  );
}

interface FrameCapture {
  frame: Frame;
  id: string;
  path: string[];
  raw: RawSnapshot;
}

function frameIdOf(state: SnapshotState, frame: Frame): string {
  let id = state.frameIds.get(frame);
  if (!id) {
    id = `f${state.nextContainer++}`;
    state.frameIds.set(frame, id);
  }
  return id;
}

function framePath(state: SnapshotState, page: Page, frame: Frame): string[] {
  const path: string[] = [];
  for (
    let f: Frame | null = frame;
    f && f !== page.mainFrame();
    f = f.parentFrame()
  ) {
    path.unshift(frameIdOf(state, f));
  }
  return path;
}

// Writes the text format (one page of it) into the snapshot.
function render(snapshot: Snapshot, body: Line[], page?: number): void {
  const flag = currentSabotage();
  const head = header(snapshot);
  const pages = paginate(head, body);
  const pageNumber = Math.min(Math.max(page ?? 1, 1), pages.length);
  const lines = pages[pageNumber - 1];
  const remaining = pages
    .slice(pageNumber)
    .reduce((n, p) => n + p.filter((l) => l.ref).length, 0);
  const rendered = [...head, ...lines.map((l) => l.text)];
  snapshot.truncated = undefined;
  if (pages.length > 1) {
    snapshot.truncated = {
      page: pageNumber,
      pages: pages.length,
      elements_remaining: remaining,
    };
    rendered.push(
      pageNumber < pages.length
        ? `… ${remaining.toLocaleString('en-US')} more elements — request page ${pageNumber + 1} of ${pages.length}`
        : `… end of page ${pageNumber} of ${pages.length}`,
    );
  }
  snapshot.text = rendered.join('\n');
  if (flag === 'cut_mid_element') {
    // Cut by character count, in the middle of the last element line.
    const last = snapshot.text.lastIndexOf('\n- ');
    if (last > 0) snapshot.text = snapshot.text.slice(0, last + 6);
  }
}

export type SnapshotOptions = Omit<CaptureInput, 'session_id'>;

// `internal` is for the engine's own bookkeeping around an action: the data
// without the text rendering, and without a defensive copy.
export async function takeSnapshot(
  session: HauntSession,
  options: SnapshotOptions = {},
  internal = false,
): Promise<Snapshot> {
  const state = session.snapshot;
  const page = session.page;
  const format = options.format ?? 'text';

  // The page's JavaScript is frozen while a dialog is up, so nothing can be
  // read from it: say so, on top of what was last seen.
  if (state.dialog && state.previous) {
    const frozen: Snapshot = {
      ...state.previous.snapshot,
      dialog: state.dialog as Snapshot['dialog'],
      tabs: await tabsOf(session),
    };
    render(frozen, state.previous.body, options.page);
    if (format === 'json') {
      frozen.elements = state.previous.elements;
      frozen.containers = state.previous.containers;
    }
    return JSON.parse(JSON.stringify(frozen));
  }

  const within = options.within ? state.targets.get(options.within) : undefined;
  const frames = within ? [within.frame] : page.frames();
  state.seq++;
  const readAt = Date.now();
  const flag = currentSabotage();
  const collectOptions = (frame: Frame) => ({
    sabotage:
      flag === 'closed_shadow_dropped' || flag === 'redaction_by_label_only'
        ? flag
        : undefined,
    attributes: options.include_attributes ?? [],
    within: within && within.frame === frame ? within.local : undefined,
  });

  const captures: FrameCapture[] = [];
  await Promise.all(
    frames.map(async (frame) => {
      if (frame.isDetached()) return;
      const json = await withTimeout(
        frame.evaluate(collect, collectOptions(frame)),
        COLLECT_TIMEOUT_MS,
      );
      if (!json) return;
      const raw = JSON.parse(json) as RawSnapshot;
      captures.push({
        frame,
        id: frame === page.mainFrame() ? '' : frameIdOf(state, frame),
        path: framePath(state, page, frame),
        raw,
      });
    }),
  );
  // Main frame first, then frames in the order the page lists them.
  const order = new Map(page.frames().map((frame, index) => [frame, index]));
  captures.sort(
    (a, b) => (order.get(a.frame) ?? 0) - (order.get(b.frame) ?? 0),
  );

  const containers: SnapshotContainer[] = [];
  const elements: SnapshotElement[] = [];
  const body: Line[] = [];
  const textParts: string[] = [];
  const previousRefs = state.previous?.comparable;

  // Sabotage only: numbers handed out afresh at every snapshot.
  const positional = new Map<string, string>();
  const refFor = (capture: FrameCapture, local: number): string => {
    const key = `${capture.id}:${capture.raw.doc}:${local}`;
    if (flag === 'reference_reused') {
      let reused = positional.get(key);
      if (!reused) {
        reused = `e${positional.size + 1}`;
        positional.set(key, reused);
        state.targets.set(reused, {
          frame: capture.frame,
          doc: capture.raw.doc,
          local,
        });
      }
      return reused;
    }
    let ref = state.refByKey.get(key);
    if (!ref) {
      ref = `e${state.nextRef++}`;
      state.issuedAt.set(ref, state.seq);
      state.refByKey.set(key, ref);
      state.targets.set(ref, {
        frame: capture.frame,
        doc: capture.raw.doc,
        local,
      });
    }
    return ref;
  };
  const shadowIdFor = (capture: FrameCapture, local: number): string => {
    const key = `${capture.id}:${capture.raw.doc}:${local}`;
    let id = state.shadowIds.get(key);
    if (!id) {
      id = `s${state.nextContainer++}`;
      state.shadowIds.set(key, id);
    }
    return id;
  };

  for (const capture of captures) {
    if (capture.id) {
      containers.push({
        id: capture.id,
        kind: 'frame',
        path: capture.path.slice(0, -1),
        url: capture.frame.url(),
      });
      body.push({
        text: `${'  '.repeat(capture.path.length - 1)}Frame ${capture.id}: ${capture.frame.url()}`,
      });
    }
    for (const shadow of capture.raw.shadows) {
      containers.push({
        id: shadowIdFor(capture, shadow.local),
        kind: 'shadow',
        mode: shadow.mode,
        path: [
          ...capture.path,
          ...shadow.parents.map((p) => shadowIdFor(capture, p)),
        ],
      });
    }

    const built = capture.raw.elements.map(
      (raw: RawElement): SnapshotElement => {
        const { local, shadow, covered_by, ...fields } = raw;
        const ref = refFor(capture, local);
        const element: SnapshotElement = {
          ref,
          ...fields,
          path: [
            ...capture.path,
            ...shadow.map((s) => shadowIdFor(capture, s)),
          ],
        };
        if (covered_by !== undefined)
          element.covered_by = refFor(capture, covered_by);
        if (previousRefs && !previousRefs.has(ref)) element.is_new = true;
        state.described.set(ref, identity(element));
        return element;
      },
    );
    elements.push(...built);

    let below: boolean | undefined;
    for (const item of capture.raw.items) {
      if ('el' in item) {
        const element = built[item.el];
        // Marked once per run of elements rather than on every line.
        if (!element.hidden && Boolean(element.offscreen) !== below) {
          below = Boolean(element.offscreen);
          if (below || body.some((l) => l.text.startsWith('-- outside'))) {
            body.push({
              text: below
                ? '-- outside the visible area --'
                : '-- in the visible area --',
            });
          }
        }
        body.push({
          text: elementLine(element, element.path.length),
          ref: element.ref,
        });
      } else {
        textParts.push(item.text);
        if (!options.actionable_only) {
          const text = clip(item.text, MAX_TEXT_LINE_CHARS).replace(
            /^- /,
            '\\- ',
          );
          const depth = '  '.repeat(capture.path.length);
          body.push({
            text: item.heading
              ? `${depth}${'#'.repeat(item.heading)} ${text}`
              : `${depth}${text}`,
          });
        }
      }
    }
  }

  const main = captures.find((c) => c.id === '');
  const snapshot: Snapshot = {
    url: page.url(),
    title: (await withTimeout(page.title(), 1_000)) ?? '',
    text: '',
    scroll: main?.raw.scroll ?? { x: 0, y: 0, max_x: 0, max_y: 0 },
    tabs: await tabsOf(session),
  };
  if (state.dialog) snapshot.dialog = state.dialog as Snapshot['dialog'];

  if (!internal) render(snapshot, body, options.page);

  // --- diff against the previous snapshot of this session
  const now = new Map(elements.map((e) => [e.ref, comparable(e)]));
  if (options.diff) {
    snapshot.diff = diffBetween(
      state.previous?.comparable ?? new Map<string, string>(),
      elements,
    );
  }

  if (format === 'json') {
    snapshot.elements = elements;
    snapshot.containers = containers;
    snapshot.truncated = undefined;
  }

  // A scoped snapshot is a partial view: it must not make everything outside
  // it look removed next time.
  if (!within) {
    state.previous = {
      comparable: now,
      textHash: textParts.join('\n'),
      snapshot: { ...snapshot, elements: undefined, containers: undefined },
      elements,
      containers,
      body,
      at: readAt,
    };
  }
  return internal ? snapshot : JSON.parse(JSON.stringify(snapshot));
}
