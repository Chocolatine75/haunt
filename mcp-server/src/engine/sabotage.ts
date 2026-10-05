// mcp-server/src/engine/sabotage.ts
//
// Deliberate breakages of the engine, for the gates' own tests (G7.1, S8.1). Each
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
  // Part 2, signals.
  'signals_late_dropped',
  'signals_latest_step',
  'signals_sandbox_blocks',
  'signals_no_dedup',
  'signals_console_line',
  'signals_ignore_4xx',
  'signals_secrets_kept',
  'signals_end_dropped',
  'signals_no_audit',
  'signals_audit_every_action',
  // Part 3, evidence.
  'evidence_refs_not_locators',
  'evidence_failed_replayed',
  'evidence_one_replay',
  'evidence_flaky_as_confirmed',
  'evidence_rejected_reported',
  'evidence_secrets_in_trace',
  'evidence_screenshots_unmasked',
  'evidence_cap_ignored',
  'evidence_same_session',
  // Part 4, the tester.
  'tester_hidden_dropped',
  'tester_coverage_by_plan',
  'tester_expectation_assumed',
  'tester_list_unscoped',
  'tester_budget_ignored',
  'tester_secret_read',
  'tester_unchecked_confirmed',
  'tester_case_not_replayed',
  // Not a breakage: nothing recorded, to measure what recording costs
  // (E7.4).
  'evidence_off',
  // Not a breakage: nothing collected at all, to measure what collecting
  // costs (S8.4).
  'signals_off',
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
