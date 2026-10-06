// mcp-server/src/gates/part-4-field/status.ts
//
// Which gate tests of docs/v3/part-4-field.md the implementation is
// expected to pass today, as in the parts: an id not listed runs as an
// expected failure, and goes red the moment it starts passing.
export const PASSING: ReadonlySet<string> = new Set<string>([
  // The gate's own bookkeeping holds from day one.
  'F9.1',
  // Was already so: a session ends when asked.
  'F1.2',
  'F1.3',
  'F1.1',
]);
