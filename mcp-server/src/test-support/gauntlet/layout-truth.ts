// mcp-server/src/test-support/gauntlet/layout-truth.ts
//
// What each layout page must raise in its buggy variant (layout-truth.json):
// as it loads, and once its steps have been played. The clean variant raises
// nothing, at any point. layout.test.ts checks the geometry these stand on
// against what the browser really lays out.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LayoutPage } from './server.js';

export interface ExpectedLayout {
  rule: string;
  severity: 'major' | 'minor';
  // The control it is about, when it is about one.
  name?: string;
  // Something its message says.
  contains?: string;
}

export interface LayoutStep {
  type: 'click' | 'resize';
  // data-g of the control clicked.
  target?: string;
  width?: number;
  height?: number;
}

export interface LayoutTruth {
  load: ExpectedLayout[];
  steps: LayoutStep[];
  // Raised by the steps, beyond what the load raised.
  after: ExpectedLayout[];
}

export function loadLayoutTruth(): Record<LayoutPage, LayoutTruth> {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./layout-truth.json', import.meta.url)),
      'utf-8',
    ),
  );
}
