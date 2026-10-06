// mcp-server/src/gates/part-4-sweep/status.ts
//
// Which gate tests of the sweep (docs/v3/part-4-sweep.md) the implementation
// is expected to pass today, as in the parts: an id not listed runs as an
// expected failure, and goes red the moment it starts passing.
export const PASSING: ReadonlySet<string> = new Set<string>([
  // The gate's own bookkeeping holds from day one.
  'W3.2',
]);
