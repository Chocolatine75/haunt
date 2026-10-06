// mcp-server/src/engine/end-session.ts
import type { Signal } from '../gates/part-2/contract.js';
import type {
  SignalVerifications,
  VerifiedIssue,
} from '../gates/part-3/contract.js';
import type {
  CaseStatus,
  Coverage,
  InventoryControl,
} from '../gates/part-4/contract.js';
import { SETTLE_CAP_MS } from './act/act.js';
import { pendingTimers } from './act/page-fns.js';
import { SESSION_TTL_MS } from './constants.js';
import { verifySession } from './evidence/verify.js';
import { planOf, syncInventory } from './plan/plan.js';
import { sabotaged } from './sabotage.js';
import type { SessionManager } from './session/manager.js';
import { takeSnapshot } from './snapshot/snapshot.js';
import type { HauntSession, Issue } from './types.js';

export interface EndSessionInput {
  session_id: string;
  overall_impression?: string;
  // What the last action revealed: there is no later call to carry it.
  issues?: Issue[];
}

export interface EndSessionOutput {
  session_id: string;
  duration_seconds: number;
  pages_visited: number;
  step_count: number;
  // Issues verified by replay: confirmed, flaky or unverified (R-E8 …
  // R-E12). The rejected ones are apart, with why.
  issues_found: VerifiedIssue[];
  rejected: VerifiedIssue[];
  sandbox_blocked_requests: string[];
  // Every signal of the session, counted once each, and how each fared
  // when replayed.
  signals: Signal[];
  signal_verification: SignalVerifications;
  // The plan as it stands, and how much of it was done (part 4, R-T4).
  cases: CaseStatus[];
  coverage: Coverage;
  // Every control the session was shown: what a report merges sessions by.
  inventory: InventoryControl[];
  overall_impression: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// What the last action set in motion may not have happened yet: a request
// still on the wire, a timer not yet due. There is no later call to report
// it with, so it is waited for here, within the cap an action waits
// (R-S8).
export async function lastEffects(session: HauntSession): Promise<void> {
  if (sabotaged('signals_off')) return;
  const { collector } = session;
  const deadline = Date.now() + SETTLE_CAP_MS;
  for (;;) {
    let timers = 0;
    if (!session.runtime.dialog && !session.page.isClosed()) {
      const counts = await Promise.all(
        session.page
          .frames()
          .map((frame) =>
            frame
              .evaluate(pendingTimers, collector.lastStepStart)
              .catch(() => 0),
          ),
      );
      timers = counts.reduce((sum, count) => sum + count, 0);
    }
    if (timers === 0 && collector.awaited() === 0) return;
    if (Date.now() >= deadline) return;
    await sleep(50);
  }
}

export async function hauntEndSession(
  manager: SessionManager,
  input: EndSessionInput,
): Promise<EndSessionOutput> {
  const session = manager.get(input.session_id);
  // A model asked for "anything not reported yet" tends to repeat itself.
  const known = new Set(session.issues.map((issue) => JSON.stringify(issue)));
  for (const issue of input.issues ?? []) {
    if (!known.has(JSON.stringify(issue))) session.issues.push(issue);
  }

  await lastEffects(session);
  // The inventory as the last action left the page.
  if (!session.runtime.dialog && !session.page.isClosed()) {
    await takeSnapshot(session, { format: 'json' }, true).catch(() => {});
    await syncInventory(session).catch(() => {});
  }
  const plan = planOf(session);
  // Replayed in browsers of their own before anything is reported; the
  // session's browser stays open meanwhile, for nothing but its cookies.
  const signals = session.collector.all();
  const verified = await verifySession(session, session.issues, signals);

  await session.browser.close();
  manager.delete(input.session_id);
  await manager.reapStale(SESSION_TTL_MS);

  const duration_seconds = Math.round(
    (Date.now() - session.start_time) / 1_000,
  );

  const output: EndSessionOutput = {
    session_id: session.id,
    duration_seconds,
    pages_visited: session.pages_visited.length,
    step_count: session.step_count,
    issues_found: verified.issues_found,
    rejected: verified.rejected,
    sandbox_blocked_requests: session.sandbox_blocked_requests,
    signals,
    signal_verification: verified.signal_verification,
    cases: plan.cases,
    coverage: plan.coverage,
    inventory: plan.inventory,
    overall_impression:
      input.overall_impression ??
      `Completed ${session.step_count} steps across ${session.pages_visited.length} pages.`,
  };

  manager.keepEnded(session.id, {
    result: output as unknown as Record<string, unknown>,
    portable: plan.portable,
  });
  return output;
}

// What a session's end says of it when asked to be brief: what became of
// its issues, and the counts. The signals and the inventory stay on the
// server for the report.
export function briefEnd(output: EndSessionOutput): EndSessionBrief {
  const told = (issue: VerifiedIssue) => ({
    description: issue.description,
    severity: issue.severity,
    status: issue.verification.status,
    ...(issue.verification.reason ? { reason: issue.verification.reason } : {}),
    ...(issue.verification.bundle ? { bundle: issue.verification.bundle } : {}),
  });
  return {
    session_id: output.session_id,
    step_count: output.step_count,
    issues_found: output.issues_found.map(told),
    rejected: output.rejected.map(told),
    signals: output.signals.length,
    coverage: {
      controls: output.coverage.controls,
      cases: output.coverage.cases,
    },
    overall_impression: output.overall_impression,
  };
}

export interface EndSessionBrief {
  session_id: string;
  step_count: number;
  issues_found: Array<Record<string, unknown>>;
  rejected: Array<Record<string, unknown>>;
  // How many; the report has them.
  signals: number;
  coverage: Pick<Coverage, 'controls' | 'cases'>;
  overall_impression: string;
}
