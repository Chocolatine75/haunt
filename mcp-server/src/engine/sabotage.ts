// mcp-server/src/engine/sabotage.ts
//
// Deliberate breakages of the engine, for the gate's own tests (G7.1). Each
// one removes a property the gate is supposed to verify; the gate must then
// fail. A breakage that leaves the gate green is a hole in the gate.
//
// The switch only works inside a test run and cannot be reached through MCP.
export const SABOTAGES = [
  'scripted_click',
  'stale_resolved_by_name',
  'no_settling',
  'no_actionability_check',
  'closed_shadow_dropped',
  'cut_mid_element',
  'ok_on_covered',
  'reference_reused',
  'redaction_by_label_only',
  'new_tab_unsandboxed',
] as const;

export type Sabotage = (typeof SABOTAGES)[number];

let current: Sabotage | null = null;

export function setSabotage(name: string | null): void {
  if (name === null) {
    current = null;
    return;
  }
  if (!process.env.VITEST) {
    throw new Error('sabotage is only available inside the test runner');
  }
  if (!(SABOTAGES as readonly string[]).includes(name)) {
    throw new Error(`unknown sabotage: ${name}`);
  }
  current = name as Sabotage;
}

export function currentSabotage(): Sabotage | null {
  return current;
}

export function sabotaged(name: Sabotage): boolean {
  return current === name;
}
