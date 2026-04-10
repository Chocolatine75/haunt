import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './manager.js';
import type { HauntSession } from '../types.js';

const mockSession = { id: 'test-id' } as unknown as HauntSession;

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
    expect(() => manager.delete('missing')).toThrow('Session not found: missing');
  });
});
