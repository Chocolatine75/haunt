// mcp-server/src/test-support/gauntlet/tester-truth.ts
//
// What each tester page offers and what a correct tester checks on it
// (tester-truth.json). The controls are the page's whole inventory; each
// case is the steps to play and the expectation to state, which fails on
// the buggy variant and holds on the clean one. tester.test.ts checks this
// against what the browser really does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TesterPage } from './server.js';

// A control of the page, by its data-g, as the inventory must list it.
export interface TesterControl {
  g: string;
  role: string;
  name: string;
  // "<role>: <name>" of the form, dialog, group or region around it, or
  // "page".
  group: string;
  // As the page loads.
  state?: 'hidden' | 'disabled';
}

export interface TesterStep {
  type: 'click' | 'fill' | 'check' | 'select' | 'press';
  // data-g of the control; absent for a key pressed wherever the focus is.
  target?: string;
  text?: string;
  values?: string[];
  keys?: string;
}

// What the case expects, with controls named by data-g where the tools take
// a reference.
export interface TesterCheck {
  text_present?: string;
  list?: {
    within: { role: string; name: string };
    items: string;
    count?: { eq?: number; min?: number; max?: number };
    every_contains?: string;
    none_contains?: string;
    order?: 'ascending' | 'descending';
    as?: 'number' | 'text';
    equals?: string[];
  };
  value?: {
    target: string;
    of: 'value' | 'checked' | 'expanded' | 'pressed' | 'focused';
    is: string | boolean;
  };
}

export interface TesterCase {
  id: string;
  kind: 'normal' | 'edge' | 'state' | 'keyboard' | 'visual';
  // data-g of the controls it exercises.
  controls: string[];
  expect: string;
  steps: TesterStep[];
  check: TesterCheck;
  // What the check reads on each variant, for a list or a value.
  read?: { buggy: unknown; clean: unknown };
}

export interface TesterTruth {
  controls: TesterControl[];
  // Controls that become usable once another is clicked.
  opens?: { by: string; controls: string[] };
  cases: TesterCase[];
}

export function loadTesterTruth(): Record<TesterPage, TesterTruth> {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./tester-truth.json', import.meta.url)),
      'utf-8',
    ),
  );
}
