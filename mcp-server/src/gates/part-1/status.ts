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
  // Actions.
  'G2.0',
  'G2.1',
  'G2.2',
  'G2.3',
  'G2.4',
  'G2.5',
  'G2.6',
  'G2.7',
  'G2.8',
  'G2.9',
  'G2.10',
  'G2.11',
  'G2.12',
  'G2.13',
  'G2.14',
  'G2.15',
  'G2.16',
  'G2.17',
  'G3.1',
  'G3.2',
  'G3.3',
  'G3.4',
  'G3.5',
  'G3.6',
  'G3.7',
  'G3.8',
  'G4.1',
  'G4.2',
  'G4.3',
  'G4.4',
  'G4.5',
  'G4.6',
  'G5.1',
  'G5.2',
  'G6.2',
  'G6.3',
  'G7.1',
  'G6.1',
  'G6.4',
]);
