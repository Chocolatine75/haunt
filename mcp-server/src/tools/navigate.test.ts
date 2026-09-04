import { describe, expect, it } from 'vitest';
import { SessionManager } from '../session/manager.js';
import type { HauntSession } from '../types.js';
import { hauntNavigate } from './navigate.js';

function mockSessionAtStepLimit(): HauntSession {
  return {
    id: 'session-id',
    step_count: 3,
    max_steps: 3,
    last_activity: Date.now(),
    issues: [],
    pages_visited: [],
    console_errors: [],
    network_errors: [],
  } as unknown as HauntSession;
}

describe('hauntNavigate', () => {
  it('refuses to act once step_count reaches max_steps', async () => {
    const manager = new SessionManager();
    const session = mockSessionAtStepLimit();
    manager.set(session.id, session);

    await expect(
      hauntNavigate(manager, { session_id: session.id, action: 'click Login' }),
    ).rejects.toThrow(/step limit/);

    // Guard fires before touching the page, so step_count is left unchanged
    expect(session.step_count).toBe(3);
  });
});
