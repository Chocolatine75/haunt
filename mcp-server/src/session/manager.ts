import type { HauntSession } from '../types.js';

export class SessionManager {
  private readonly sessions = new Map<string, HauntSession>();

  set(id: string, session: HauntSession): void {
    this.sessions.set(id, session);
  }

  get(id: string): HauntSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);
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
}
