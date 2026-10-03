// mcp-server/src/gates/part-2/planted.ts
//
// What part 1's gauntlet pages are entitled to produce as signals. Those
// pages were written to be hard to act on, not to misbehave, so anything
// they produce beyond this list is a false signal (S2.2, S2.3).
//
// Imported by part 1's harness, which checks every session of the part 1
// gate against it: nothing here may import a harness.
import type { GauntletPage } from '../../test-support/gauntlet/server.js';
import type { Signal } from './contract.js';

// A kind, or "a11y:<rule>" for one accessibility rule.
export const PLANTED: Record<GauntletPage, string[]> = {
  // "One field that nothing names" is the page's own trap.
  forms: ['a11y:label'],
  shadow: [],
  frames: [],
  selects: [],
  overlays: [],
  // "A menu entry with no handler" (G4.1).
  hover: ['dead_control'],
  // The resize handle is a focusable separator without a value.
  dnd: ['a11y:aria-required-attr'],
  upload: [],
  scroll: [],
  tabs: [],
  dialogs: [],
  dupes: [],
  dynamic: [],
  editor: [],
  huge: [],
  // "A button that is enabled and wired to nothing."
  states: ['dead_control'],
  spa: [],
  escape: [],
  login: [],
};

const label = (signal: Signal) =>
  signal.kind === 'a11y' ? `a11y:${signal.rule}` : signal.kind;

// The signals a part 1 page did not plant. A signal on a URL that is not a
// part 1 page (a sub-page, the other origin) is unplanted too.
export function unplanted(signals: Signal[]): Signal[] {
  return signals.filter((signal) => {
    const page = new URL(signal.url).pathname.split('/')[1] as GauntletPage;
    return !(PLANTED[page] ?? []).includes(label(signal));
  });
}
