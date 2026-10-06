// mcp-server/src/engine/signals/layout.ts
//
// Layout defects as signals (part 5): a control covered by another, two
// controls overlapping, text that leaves its box, a modal outside the
// window, a page wider than it. Found by geometry, with no model and no
// screenshot, on the page as an action left it.
//
// A fifth of the bugs annotated in CATTest are of this kind (a "Stop
// sharing" button under a control bar, a payment modal centred on the page
// instead of the window), and no tool compared on its pilot reported one.
import type { SnapshotElement } from '../../gates/part-1/contract.js';
import { sabotaged } from '../sabotage.js';
import type { HauntSession } from '../types.js';
import { type LayoutIssue, layoutIssues } from './layout-page.js';

export const LAYOUT_RULES = [
  'covered',
  'overlap',
  'text_overflow',
  'dialog_outside_viewport',
  'page_overflow',
] as const;

export type LayoutRule = (typeof LAYOUT_RULES)[number];

// A layout defect, as it leaves the engine with the other signals.
export interface LayoutFinding {
  rule: LayoutRule;
  severity: 'major' | 'minor';
  message: string;
  // The control it is about, when it is about one.
  ref?: string;
  role?: string;
  name?: string;
}

const control = (e: SnapshotElement) => `the ${e.role} "${e.name}"`;

// Reads the layout of the page as it was last snapshot.
export async function layoutOf(
  session: HauntSession,
): Promise<LayoutFinding[]> {
  if (sabotaged('signals_off') || sabotaged('layout_unread')) return [];
  if (session.page.isClosed()) return [];
  if (session.runtime.dialog) return [];
  const read = session.snapshot.previous;
  if (!read) return [];
  const frame = session.page.mainFrame();
  // The main frame's controls: a frame is a page of its own.
  const mine = read.elements.filter(
    (e) => session.snapshot.targets.get(e.ref)?.frame === frame,
  );
  const first = mine[0] && session.snapshot.targets.get(mine[0].ref);
  if (!first) return [];
  const byLocal = new Map(
    mine.flatMap((e) => {
      const target = session.snapshot.targets.get(e.ref);
      return target ? [[target.local, e] as const] : [];
    }),
  );
  let issues: LayoutIssue[];
  try {
    issues = await frame.evaluate(layoutIssues, {
      doc: first.doc,
      locals: [...byLocal.keys()],
    });
  } catch {
    return [];
  }
  const findings: LayoutFinding[] = [];
  for (const issue of issues) {
    const subject =
      issue.local !== undefined ? byLocal.get(issue.local) : undefined;
    const other =
      issue.other !== undefined ? byLocal.get(issue.other) : undefined;
    const about = subject ? control(subject) : issue.what;
    const who = subject
      ? { ref: subject.ref, role: subject.role, name: subject.name }
      : {};
    switch (issue.rule) {
      case 'covered':
        if (!subject) break;
        findings.push({
          rule: 'covered',
          severity: 'major',
          message: `${control(subject)[0].toUpperCase()}${control(subject).slice(1)} is covered by ${other ? control(other) : `another element (${issue.by})`}: a click on it lands on what covers it`,
          ...who,
        });
        break;
      case 'overlap':
        if (!subject || !other) break;
        findings.push({
          rule: 'overlap',
          severity: 'minor',
          message: `The ${subject.role} "${subject.name}" and the ${other.role} "${other.name}" overlap`,
          ...who,
        });
        break;
      case 'text_overflow':
        findings.push({
          rule: 'text_overflow',
          severity: 'minor',
          message: `The text of ${about} ${issue.by === 'cut off' ? 'is cut off by its box' : 'spills out of its box'} (${issue.px} px)`,
          ...who,
        });
        break;
      case 'dialog_outside_viewport':
        findings.push({
          rule: 'dialog_outside_viewport',
          severity: 'major',
          message: `The dialog ${issue.what} opened mostly outside the window: it has to be scrolled to`,
        });
        break;
      case 'page_overflow':
        findings.push({
          rule: 'page_overflow',
          severity: 'minor',
          message: `The page is ${issue.px} px wider than the window (${session.page.viewportSize()?.width ?? '?'} px): it scrolls sideways`,
        });
        break;
    }
  }
  return findings;
}

// What each session last read the layout of: the page, how many controls a
// user could see on it, and the size of the window.
const read = new WeakMap<HauntSession, Map<string, string>>();

// Reads the layout of the page the session is on if it may have changed
// since it was last read in this session: the page is new to it, the
// controls shown are not as many (a dialog opened, a panel closed), or the
// window is another size. Raises what it finds as signals of `step`.
export async function layoutIfDue(
  session: HauntSession,
  step: number,
): Promise<void> {
  if (session.page.isClosed()) return;
  const url = session.page.url();
  let key: string;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return;
    key = `${parsed.origin}${parsed.pathname}`;
  } catch {
    return;
  }
  let seen = read.get(session);
  if (!seen) {
    seen = new Map();
    read.set(session, seen);
  }
  const size = session.page.viewportSize();
  const shown = (session.snapshot.previous?.elements ?? []).filter(
    (e) => !e.hidden,
  ).length;
  const state = `${shown}|${size?.width}x${size?.height}`;
  if (seen.get(key) === state) return;
  seen.set(key, state);
  session.collector.fromLayout(url, step, await layoutOf(session));
}
