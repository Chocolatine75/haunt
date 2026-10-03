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
]);
