// mcp-server/src/gates/part-3/status.ts
//
// Which part 3 gate tests the implementation is expected to pass today, as
// in parts 1 and 2: an id not listed runs as an expected failure, and goes
// red the moment it starts passing.
//
// Part 3 is accepted when every gate test id is listed and E7 passes.
export const PASSING: ReadonlySet<string> = new Set<string>([
  // The gate's own bookkeeping holds from day one.
  'E7.2',
  // The earlier gates, unchanged.
  'E7.3',
  'E1.1',
  'E1.2',
  'E1.3',
  'E1.4',
  'E1.5',
  'E2.1',
  'E2.2',
  'E2.3',
  'E2.4',
  'E3.1',
  'E3.2',
  'E3.3',
  'E3.4',
  'E4.1',
  'E4.2',
  'E4.3',
  'E5.1',
  'E5.2',
  'E6.1',
  'E6.2',
  'E6.3',
  'E6.4',
  'E7.1',
  'E7.4',
]);
