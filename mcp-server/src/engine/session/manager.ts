import type { HauntSession } from '../types.js';

// What is kept of a session once it has ended, for the calls that come
// after: a tester that takes its cases from a planner's session, and the
// report, which is handed session ids rather than their whole results.
// Without it every result crosses a model's context twice, and between
// several agents that is most of what a run costs.
export interface EndedSession {
  result: Record<string, unknown>;
  // The session's cases, by what their controls are (R-T21).
  portable: unknown[];
  at: number;
}

// How many ended sessions are kept: a run has a handful.
const ENDED_KEPT = 50;

export class SessionManager {
  private readonly sessions = new Map<string, HauntSession>();
  private readonly ended = new Map<string, EndedSession>();

  keepEnded(id: string, session: Omit<EndedSession, 'at'>): void {
    this.ended.set(id, { ...session, at: Date.now() });
    while (this.ended.size > ENDED_KEPT) {
      const oldest = this.ended.keys().next().value;
      if (oldest === undefined) break;
      this.ended.delete(oldest);
    }
  }

  endedSession(id: string): EndedSession | undefined {
    return this.ended.get(id);
  }

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
