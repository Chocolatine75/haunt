// mcp-server/src/gates/part-5/status.ts
//
// Which part 5 gate tests the implementation is expected to pass today, as
// in the earlier parts: an id not listed runs as an expected failure, and
// goes red the moment it starts passing.
//
// Only the layout slice of part 5 is specified so far
// (docs/v3/part-5-layout.md).
export const PASSING: ReadonlySet<string> = new Set<string>([
  'L1.1',
  'L1.2',
  'L2.1',
  'L2.2',
  'L3.1',
  'L3.2',
  'L4.1',
  'L4.2',
]);
