import type { SessionManager } from './session/manager.js';
import { takeSnapshot } from './snapshot/snapshot.js';
// mcp-server/src/engine/scout.ts
//
// The areas of an app, from the links its first page really has: one call
// where an orchestrator used to make three (open a session, read the page,
// end the session) and pick the links out of a snapshot itself. Each of
// those calls carries the orchestrator's whole context, which measured as a
// third of what a run cost; and reading links is not a judgement.
import { hauntSpawn } from './spawn.js';
import type { SpawnInput } from './spawn.js';

export interface ScoutInput
  extends Pick<SpawnInput, 'target_url' | 'headless' | 'cookies' | 'secrets'> {
  // How many routes to return at most. Default 4.
  max?: number;
}

export interface ScoutOutput {
  // Paths on the target's own origin, the target's first, then those its
  // links lead to, in reading order. Never guessed.
  routes: string[];
  title: string;
}

export async function hauntScout(
  manager: SessionManager,
  input: ScoutInput,
): Promise<ScoutOutput> {
  const { max = 4, ...spawn } = input;
  const { session_id } = await hauntSpawn(manager, {
    ...spawn,
    budget: 1,
    // It tests nothing: no audit, and nothing to replay.
    audit: false,
    replay_budget_ms: 0,
  });
  const session = manager.get(session_id);
  try {
    const snapshot = await takeSnapshot(session, { format: 'json' }, true);
    const here = new URL(session.page.url());
    const routes = [here.pathname];
    for (const element of snapshot.elements ?? []) {
      if (element.role !== 'link' || !element.href || element.hidden) continue;
      let to: URL;
      try {
        to = new URL(element.href, here);
      } catch {
        continue;
      }
      if (to.origin !== here.origin || !/^https?:$/.test(to.protocol)) continue;
      if (!routes.includes(to.pathname)) routes.push(to.pathname);
    }
    return { routes: routes.slice(0, max), title: snapshot.title };
  } finally {
    await session.browser.close().catch(() => {});
    if (manager.has(session_id)) manager.delete(session_id);
  }
}
