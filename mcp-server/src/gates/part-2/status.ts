// mcp-server/src/gates/part-2/status.ts
//
// Which part 2 gate tests the implementation is expected to pass today.
//
// A test whose id is not listed here runs as an expected failure: CI stays
// green while it fails, and goes red the moment it starts passing — which is
// the signal to add its id here. Removing an id to get a red test through is
// weakening the gate.
//
// Part 2 is accepted when every gate test id is listed and S8 passes.
export const PASSING: ReadonlySet<string> = new Set<string>([
  // The gate's own bookkeeping holds from day one.
  'S8.2',
  // Part 1's gate, unchanged.
  'S8.3',
  // The collector, wired into spawn, act, capture and end-session.
  'S1.1',
  'S1.2',
  'S1.3',
  'S1.4',
  'S1.5',
  'S2.1',
  'S2.2',
  'S2.3',
  'S3.1',
  'S3.2',
  'S3.3',
  'S3.4',
  'S3.5',
  'S4.1',
  'S4.2',
  'S4.3',
  'S4.4',
  'S4.5',
  'S6.1',
  'S6.2',
  'S7.1b',
  'S8.1',
  'S8.4',
  // The accessibility audit.
  'S1.1b',
  'S1.2b',
  'S2.1b',
  'S2.2b',
  'S5.1',
  'S5.2',
  'S5.3',
  'S5.4',
  'S8.1b',
  // Signals in the report, haunt-ci and the command.
  'S7.1',
  'S7.2',
  'S7.3',
  'S7.4',
]);
