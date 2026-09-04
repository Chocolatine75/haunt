// mcp-server/src/tools/estimate-cost.ts
export interface EstimateCostInput {
  route_count: number;
  steps_per_route: number;
}

export type SessionSize = 'light' | 'medium' | 'heavy';

export interface EstimateCostOutput {
  browser_calls: number;
  session_size: SessionSize;
  summary_line: string;
}

// Mirrors what Phase 2 actually does per route: spawn + capture_state, then
// (navigate + capture_state) per step, then end_session.
export function hauntEstimateCost(
  input: EstimateCostInput,
): EstimateCostOutput {
  const { route_count, steps_per_route } = input;
  const browser_calls = route_count * (steps_per_route * 2 + 3);
  const session_size: SessionSize =
    browser_calls <= 6 ? 'light' : browser_calls <= 16 ? 'medium' : 'heavy';

  const summary_line = `estimated: ${route_count} routes · ${steps_per_route} steps each · ~${browser_calls} browser calls · ${session_size} session`;

  return { browser_calls, session_size, summary_line };
}
