import type { HauntSession } from '../types.js';

export class SessionManager {
  private readonly sessions = new Map<string, HauntSession>();

  set(id: string, session: HauntSession): void {
    this.sessions.set(id, session);
  }

  get(id: string): HauntSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    session.last_activity = Date.now();
    return session;
  }

  delete(id: string): void {
    if (!this.sessions.has(id)) throw new Error(`Session not found: ${id}`);
    this.sessions.delete(id);
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  all(): HauntSession[] {
    return Array.from(this.sessions.values());
  }

  // Closes and drops any session whose browser has sat idle past ttlMs — guards against
  // zombie Chromium processes when an orchestrator crashes before haunt_end_session.
  // Called at the top of every tool entrypoint; never reaps the session the caller is
  // about to act on, since that session's last_activity was just touched by get() above.
  async reapStale(ttlMs: number): Promise<string[]> {
    const now = Date.now();
    const staleIds = Array.from(this.sessions.entries())
      .filter(([, session]) => now - session.last_activity > ttlMs)
      .map(([id]) => id);

    for (const id of staleIds) {
      const session = this.sessions.get(id);
      this.sessions.delete(id);
      try {
        await session?.browser.close();
      } catch {
        // Browser may already be closed/crashed — nothing more to clean up.
      }
    }

    return staleIds;
  }
}
