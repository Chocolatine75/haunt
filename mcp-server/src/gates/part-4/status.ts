// mcp-server/src/gates/part-4/status.ts
//
// Which part 4 gate tests the implementation is expected to pass today, as
// in parts 1 to 3: an id not listed runs as an expected failure, and goes
// red the moment it starts passing.
//
// Part 4 is accepted when every gate test id is listed, T6 passes, and the
// live scorecards of T7 are committed.
export const PASSING: ReadonlySet<string> = new Set<string>([
  // The gate's own bookkeeping holds from day one.
  'T6.2',
  // The earlier gates, unchanged.
  'T6.3',
  // The engine has returned a masked screenshot since part 3.
  'T5.1',
  'T1.1',
  'T1.2',
  'T1.3',
  'T1.4',
  'T2.1',
  'T2.1b',
  'T2.2',
  'T3.1',
  'T3.2',
  'T3.3',
  'T3.4',
  // Was already so; listed now that a session's end returns its coverage.
  'T4.2',
  'T4.3',
  'T5.2',
  'T5.2b',
  'T5.2c',
  'T5.3',
  'T5.4',
  'T6.1',
  'T7.1',
  'T7.2',
  'T7.3',
  'T7.4',
]);
