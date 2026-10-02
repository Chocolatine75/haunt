import { describe, expect, it, vi } from 'vitest';
import { hauntGetCookies } from './get-cookies.js';
import { SessionManager } from './session/manager.js';
import type { HauntSession } from './types.js';

function mockSession(cookies: unknown[]): HauntSession {
  return {
    id: 'session-id',
    last_activity: 0,
    browser: { close: vi.fn().mockResolvedValue(undefined) },
    page: { context: () => ({ cookies: async () => cookies }) },
  } as unknown as HauntSession;
}

describe('hauntGetCookies', () => {
  it('returns the browser context cookies unchanged when sameSite is set', async () => {
    const manager = new SessionManager();
    const cookie = {
      name: 'sid',
      value: 'abc',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    };
    manager.set('session-id', mockSession([cookie]));

    const result = await hauntGetCookies(manager, { session_id: 'session-id' });

    expect(result.cookies).toEqual([cookie]);
  });

  it('defaults a missing sameSite to None so the cookie round-trips into haunt_spawn', async () => {
    const manager = new SessionManager();
    manager.set(
      'session-id',
      mockSession([{ name: 'sid', value: 'abc', sameSite: undefined }]),
    );

    const result = await hauntGetCookies(manager, { session_id: 'session-id' });

    expect(result.cookies[0].sameSite).toBe('None');
  });

  it('returns an empty list when the session has no cookies', async () => {
    const manager = new SessionManager();
    manager.set('session-id', mockSession([]));

    const result = await hauntGetCookies(manager, { session_id: 'session-id' });

    expect(result.cookies).toEqual([]);
  });

  it('counts as activity, so the session is not reaped as idle', async () => {
    const manager = new SessionManager();
    const session = mockSession([]);
    manager.set('session-id', session);

    await hauntGetCookies(manager, { session_id: 'session-id' });

    expect(manager.has('session-id')).toBe(true);
    expect(session.last_activity).toBeGreaterThan(0);
  });

  it('throws for an unknown session', async () => {
    await expect(
      hauntGetCookies(new SessionManager(), { session_id: 'nope' }),
    ).rejects.toThrow('Session not found: nope');
  });
});
