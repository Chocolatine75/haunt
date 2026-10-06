// mcp-server/src/gates/part-4-sweep/status.ts
//
// Which gate tests of the sweep (docs/v3/part-4-sweep.md) the implementation
// is expected to pass today, as in the parts: an id not listed runs as an
// expected failure, and goes red the moment it starts passing.
export const PASSING: ReadonlySet<string> = new Set<string>([
  'W1.1',
  'W1.2',
  'W1.3',
  'W1.4',
  'W1.5',
  'W1.6',
  'W2.1',
  'W2.2',
  'W2.3',
  'W3.1',
  'W3.2',
]);
