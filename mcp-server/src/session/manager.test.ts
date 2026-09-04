import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HauntSession } from '../types.js';
import { SessionManager } from './manager.js';

const mockSession = { id: 'test-id' } as unknown as HauntSession;

function mockSessionWithActivity(lastActivity: number): HauntSession {
  return {
    id: 'stale-id',
    last_activity: lastActivity,
    browser: { close: vi.fn().mockResolvedValue(undefined) },
  } as unknown as HauntSession;
}

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('stores and retrieves a session', () => {
    manager.set('test-id', mockSession);
    expect(manager.get('test-id')).toBe(mockSession);
  });

  it('throws when session not found', () => {
    expect(() => manager.get('missing')).toThrow('Session not found: missing');
  });

  it('reports existence correctly before and after set', () => {
    expect(manager.has('test-id')).toBe(false);
    manager.set('test-id', mockSession);
    expect(manager.has('test-id')).toBe(true);
  });

  it('deletes a session', () => {
    manager.set('test-id', mockSession);
    manager.delete('test-id');
    expect(manager.has('test-id')).toBe(false);
  });

  it('returns all stored sessions', () => {
    const sessionA = { id: 'a' } as unknown as HauntSession;
    const sessionB = { id: 'b' } as unknown as HauntSession;
    manager.set('a', sessionA);
    manager.set('b', sessionB);
    expect(manager.all()).toHaveLength(2);
    expect(manager.all()).toContain(sessionA);
    expect(manager.all()).toContain(sessionB);
  });

  it('throws when deleting a non-existent session', () => {
    expect(() => manager.delete('missing')).toThrow(
      'Session not found: missing',
    );
  });

  it('touches last_activity on get', () => {
    const session = mockSessionWithActivity(0);
    manager.set(session.id, session);
    manager.get(session.id);
    expect(session.last_activity).toBeGreaterThan(0);
  });

  describe('reapStale', () => {
    it('closes and removes sessions idle past ttlMs', async () => {
      const stale = mockSessionWithActivity(Date.now() - 20_000);
      manager.set(stale.id, stale);

      const reaped = await manager.reapStale(10_000);

      expect(reaped).toEqual([stale.id]);
      expect(manager.has(stale.id)).toBe(false);
      expect(stale.browser.close).toHaveBeenCalledOnce();
    });

    it('leaves sessions active within ttlMs untouched', async () => {
      const fresh = mockSessionWithActivity(Date.now());
      manager.set(fresh.id, fresh);

      const reaped = await manager.reapStale(10_000);

      expect(reaped).toEqual([]);
      expect(manager.has(fresh.id)).toBe(true);
      expect(fresh.browser.close).not.toHaveBeenCalled();
    });

    it('does not throw when a stale browser is already closed/crashed', async () => {
      const stale = mockSessionWithActivity(Date.now() - 20_000);
      (stale.browser.close as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('already closed'),
      );
      manager.set(stale.id, stale);

      await expect(manager.reapStale(10_000)).resolves.toEqual([stale.id]);
      expect(manager.has(stale.id)).toBe(false);
    });
  });
});
