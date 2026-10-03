import { describe, expect, it, vi } from 'vitest';
import { hauntEndSession } from './end-session.js';
import { SessionManager } from './session/manager.js';
import type { HauntSession } from './types.js';

function mockSession(overrides: Partial<HauntSession> = {}): HauntSession {
  return {
    id: 'session-id',
    persona: { name: 'Confused Beginner' },
    browser: { close: vi.fn().mockResolvedValue(undefined) },
    issues: [],
    sandbox_blocked_requests: [],
    pages_visited: ['http://localhost:3000/'],
    start_time: Date.now() - 5_000,
    last_activity: Date.now(),
    step_count: 4,
    ...overrides,
  } as unknown as HauntSession;
}

describe('hauntEndSession', () => {
  it('closes the browser and removes the session from the manager', async () => {
    const manager = new SessionManager();
    const session = mockSession();
    manager.set(session.id, session);

    await hauntEndSession(manager, { session_id: session.id });

    expect(session.browser.close).toHaveBeenCalledOnce();
    expect(manager.has(session.id)).toBe(false);
  });

  it('reports duration, pages visited, and step count', async () => {
    const manager = new SessionManager();
    const session = mockSession({
      start_time: Date.now() - 12_000,
      pages_visited: ['/a', '/b', '/c'],
      step_count: 7,
    });
    manager.set(session.id, session);

    const output = await hauntEndSession(manager, { session_id: session.id });

    expect(output.duration_seconds).toBeGreaterThanOrEqual(12);
    expect(output.pages_visited).toBe(3);
    expect(output.step_count).toBe(7);
    expect(output.issues_found).toBe(session.issues);
  });

  it('uses the provided overall_impression, or a computed default', async () => {
    const manager = new SessionManager();

    const withImpression = mockSession({ id: 'a' });
    manager.set('a', withImpression);
    const outA = await hauntEndSession(manager, {
      session_id: 'a',
      overall_impression: 'Confusing signup flow.',
    });
    expect(outA.overall_impression).toBe('Confusing signup flow.');

    const withoutImpression = mockSession({
      id: 'b',
      step_count: 2,
      pages_visited: ['/x'],
    });
    manager.set('b', withoutImpression);
    const outB = await hauntEndSession(manager, { session_id: 'b' });
    expect(outB.overall_impression).toBe('Completed 2 steps across 1 pages.');
  });

  it('sweeps other idle sessions while ending this one', async () => {
    const manager = new SessionManager();

    const ending = mockSession({ id: 'ending' });
    const stale = mockSession({
      id: 'stale',
      last_activity: Date.now() - 20 * 60_000,
    });
    manager.set('ending', ending);
    manager.set('stale', stale);

    await hauntEndSession(manager, { session_id: 'ending' });

    expect(manager.has('ending')).toBe(false);
    expect(manager.has('stale')).toBe(false);
    expect(stale.browser.close).toHaveBeenCalledOnce();
  });

  it('surfaces sandbox_blocked_requests in the output', async () => {
    const manager = new SessionManager();
    const session = mockSession({
      sandbox_blocked_requests: ['GET http://evil.example/ (blocked)'],
    });
    manager.set(session.id, session);

    const result = await hauntEndSession(manager, {
      session_id: session.id,
    });

    expect(result.sandbox_blocked_requests).toEqual([
      'GET http://evil.example/ (blocked)',
    ]);
  });

  it('adds the issues passed with the call to those of the session', async () => {
    const manager = new SessionManager();
    const earlier = {
      severity: 'minor' as const,
      category: 'ux' as const,
      description: 'earlier',
      page_url: '/',
      recommendation: 'r',
    };
    const session = mockSession({ issues: [earlier] });
    manager.set(session.id, session);

    const late = { ...earlier, description: 'from the last action' };
    const output = await hauntEndSession(manager, {
      session_id: session.id,
      issues: [late],
    });

    expect(output.issues_found).toEqual([earlier, late]);
  });
});
