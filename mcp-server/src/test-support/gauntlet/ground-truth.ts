// mcp-server/src/test-support/gauntlet/ground-truth.ts
//
// What each signal page must produce, as data (ground-truth.json). It
// describes the buggy variant; the clean variant of every page produces
// nothing at all. A gate test compares the engine's signals with this, and
// signals.test.ts checks this against what the browser really does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SignalPage } from './server.js';

export interface ExpectedSignal {
  // Fields the signal must carry with exactly these values. `path` is the
  // URL's path: the origin changes on every run and a signal has no query.
  signal: {
    kind: string;
    severity: 'major' | 'minor';
    [field: string]: unknown;
  };
  // Text fields that must include this.
  contains?: Record<string, string>;
  starts_with?: Record<string, string>;
  // Numeric fields that cannot be less than this.
  at_least?: Record<string, number>;
  // For `a11y`: the offending elements, by data-g, and the data-frame of the
  // frame they are in when they are in one.
  elements?: { id: string; frame?: string }[];
}

// What a list of browser events shows and that is not a signal.
export interface NotASignal {
  kind: string;
  path?: string;
  why: string;
}

export interface Trigger {
  // data-g of the control to click.
  trigger: string;
  // data-frame of the frame the control is in.
  frame?: string;
  signals: ExpectedSignal[];
  // How long after the click its last effect happens, when that is not at
  // once.
  wait_ms?: number;
  // The click leaves the page.
  navigates?: boolean;
  // Behaves the same in the clean variant: it is not a defect.
  both_variants?: boolean;
  // A second trace of a signal already listed, not a second signal.
  same_fact?: NotASignal[];
  not_a_failure?: NotASignal[];
  // Signals only once the thresholds are lowered at spawn.
  under_threshold?: ExpectedSignal[];
  // For a working control: the one thing a click on it changes.
  effect?: 'text' | 'navigation' | 'focus' | 'scroll';
}

export interface PageTruth {
  // Signals of the initial load, attributed to step 0.
  load: ExpectedSignal[];
  // A second trace of a load signal already listed.
  load_same_fact?: NotASignal[];
  // Every control worth clicking. Each is described from a fresh load of the
  // page: after one marked `navigates`, the page has to be opened again.
  triggers: Trigger[];
  // data-g of the credential field to type a secret into first.
  secret_field?: string;
}

export function loadGroundTruth(): Record<SignalPage, PageTruth> {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./ground-truth.json', import.meta.url)),
      'utf-8',
    ),
  );
}
