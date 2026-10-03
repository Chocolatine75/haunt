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
]);
