// mcp-server/src/gates/part-1/status.ts
//
// Which gate tests the implementation is expected to pass today.
//
// A test whose id is not listed here runs as an expected failure: CI stays
// green while it fails, and goes red the moment it starts passing — which is
// the signal to add its id here. Removing an id to get a red test through is
// weakening the gate.
//
// Part 1 is accepted when every gate test id is listed and G7 passes.
export const PASSING: ReadonlySet<string> = new Set<string>([
  // The gate's own bookkeeping holds from day one.
  'G7.3',
  'G7.4',
  // Guards the tests that existed before part 1.
  'G5.6',
  // The login helper already gets past the decoy link.
  'G5.4',
  // The reference snapshot.
  'G1.1',
  'G1.2',
  'G1.3',
  'G1.4',
  'G1.5',
  'G1.6',
  'G1.7',
  'G1.8',
  'G4.5b',
  'G5.1b',
  'G6.1',
  'G6.4',
]);
