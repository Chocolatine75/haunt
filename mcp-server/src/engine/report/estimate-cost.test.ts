import { describe, expect, it } from 'vitest';
import { hauntEstimateCost } from './estimate-cost.js';

describe('hauntEstimateCost', () => {
  it('computes browser_calls as route_count × (steps×2 + 3)', () => {
    // 4 routes, 3 steps each: 4 × (3×2 + 3) = 4 × 9 = 36
    const result = hauntEstimateCost({ route_count: 4, steps_per_route: 3 });
    expect(result.browser_calls).toBe(36);
  });

  it('classifies session_size: light ≤6, medium ≤16, heavy >16', () => {
    // 1 route, 1 step: 1 × (1×2+3) = 5 → light
    expect(
      hauntEstimateCost({ route_count: 1, steps_per_route: 1 }).session_size,
    ).toBe('light');
    // 2 routes, 1 step: 2 × 5 = 10 → medium
    expect(
      hauntEstimateCost({ route_count: 2, steps_per_route: 1 }).session_size,
    ).toBe('medium');
    // exactly the light/medium boundary: 6 calls
    expect(
      hauntEstimateCost({ route_count: 1, steps_per_route: 1.5 }).session_size,
    ).toBe('light');
    // 4 routes, 3 steps: 36 → heavy
    expect(
      hauntEstimateCost({ route_count: 4, steps_per_route: 3 }).session_size,
    ).toBe('heavy');
  });

  it('formats the exact summary line', () => {
    const result = hauntEstimateCost({ route_count: 4, steps_per_route: 3 });
    expect(result.summary_line).toBe(
      'estimated: 4 routes · 3 steps each · ~36 browser calls · heavy session',
    );
  });
});
