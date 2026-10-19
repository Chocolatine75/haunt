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
import { SETTLE_CAP_MS, hauntAct } from './act/act.js';
import { pendingTimers } from './act/page-fns.js';
import { SESSION_TTL_MS } from './constants.js';
import { verifySession } from './evidence/verify.js';
import { coverageOf, planOf, syncInventory } from './plan/plan.js';
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

// The window a session's layout is read on before it ends, when asked.
export const NARROW = { width: 375, height: 800 };

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

// Below which what is left of a budget is not worth holding a session
// back for.
const WORTH_GOING_ON = 0.25;
// How many controls never used are worth it by themselves, and how many
// are named.
const CONTROLS_WORTH = 5;
const CONTROLS_NAMED = 20;
// How many times a session is held back before it is let go.
const HELD_MAX = 3;

export interface HeldBack {
  ended: false;
  left: {
    cases: string[];
    controls: Array<{ ref: string; role: string; name: string }>;
  };
  steps_remaining: number;
  // One thing to do, named.
  next: string;
  todo: string;
}

// Whether a session asked to end is held back instead (R-F1): when it
// asked for that at spawn and still has cases without a verdict or controls
// never used, and a quarter of its budget or more. Three times at most. The
// issues passed with the call are kept either way.
//
// On nine applications of CATTest the testers used 11 to 30 of their 40
// actions and left cases unplayed on every one. The brief tells them to
// spend the rest on what remains; a line in a prompt did not make them.
// Nor did being held back once: two of three called again at once. So it
// is three times, and each names one thing to do rather than a list to
// choose from.
export async function heldBack(
  manager: SessionManager,
  input: EndSessionInput,
): Promise<HeldBack | undefined> {
  if (!manager.has(input.session_id)) return undefined;
  const session = manager.get(input.session_id);
  const { evidence } = session;
  const times = evidence.held_back ?? 0;
  if (!evidence.keep_going || times >= HELD_MAX) return undefined;
  const steps_remaining = session.max_steps - session.step_count;
  if (steps_remaining < session.max_steps * WORTH_GOING_ON) return undefined;
  if (session.runtime.dialog || session.page.isClosed()) return undefined;

  // What the last action left is in the inventory before it is counted.
  await takeSnapshot(session, { format: 'json' }, true).catch(() => {});
  await syncInventory(session).catch(() => {});
  const cases = coverageOf(session).left.cases;
  // A page that draws itself again gives its controls new references: on
  // CATTest 27 the count of controls "never used" went from 90 to 116
  // while the tester was using them, and it was sent back to a button it
  // had already pressed. A control is used when one of the same role, name
  // and group was, and only what is on the page now is named.
  const keyOf = (control: { role: string; name: string; group: string }) =>
    JSON.stringify([control.group, control.role, control.name]);
  const used = new Set(
    [...session.plan.controls.values()].filter((c) => c.exercised).map(keyOf),
  );
  const shown = new Set(
    (session.snapshot.previous?.elements ?? []).map((element) => element.ref),
  );
  const seen = new Set<string>();
  const controls = [...session.plan.controls.values()]
    .filter((control) => {
      const key = keyOf(control);
      if (!shown.has(control.ref) || control.state || used.has(key)) {
        return false;
      }
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ ref, role, name }) => ({ ref, role, name }));
  // With no case at all nothing was checked, whatever was pressed.
  const unplanned = session.plan.cases.size === 0;
  if (!unplanned && cases.length === 0 && controls.length < CONTROLS_WORTH) {
    return undefined;
  }

  evidence.held_back = times + 1;
  const known = new Set(session.issues.map((issue) => JSON.stringify(issue)));
  for (const issue of input.issues ?? []) {
    if (!known.has(JSON.stringify(issue))) session.issues.push(issue);
  }
  const parts = [
    unplanned ? 'no test case was registered' : '',
    cases.length > 0
      ? `${cases.length} case${cases.length === 1 ? ' has' : 's have'} no verdict (${cases.join(', ')})`
      : '',
    controls.length > 0
      ? `${controls.length} control${controls.length === 1 ? ' was' : 's were'} never used`
      : '',
  ].filter(Boolean);
  const unplayed =
    cases.length > 0 ? session.plan.cases.get(cases[0]) : undefined;
  const control = controls[0];
  const next = unplanned
    ? 'Call haunt_plan for the inventory and register a case for each part of what you have seen, saying what each should show. Then play them, each with `expect` and `case` in the haunt_act call.'
    : unplayed
      ? `Play case "${unplayed.id}" now: ${unplayed.expect} State that as \`expect\` with "case": "${unplayed.id}" in the haunt_act call.`
      : `Register a case with haunt_plan for the ${control.role} "${control.name}" [${control.ref}], saying what using it should show, and play it.`;
  const calls = HELD_MAX - evidence.held_back;
  return {
    ended: false,
    left: { cases, controls: controls.slice(0, CONTROLS_NAMED) },
    steps_remaining,
    next,
    todo: `Not ended: ${parts.join(' and ')}, and ${steps_remaining} actions are left. Do this next: ${next} Then go on with what is left, a case for each control never used. The issues you passed are kept. haunt_end_session will ${calls > 0 ? `refuse ${calls} more time${calls === 1 ? '' : 's'} while work is left` : 'end the session at the next call'}.`,
  };
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

  // The session is ending: what follows is the engine's own action, and no
  // plan is asked of it (R-F6).
  session.evidence.keep_going = false;

  // The page once more, on a window the width of a phone (part 5). As an
  // action like any other, so that it is recorded and a replay makes it
  // too; and whatever is left of the budget.
  if (
    session.evidence.narrow_check &&
    session.evidence.layout &&
    !session.runtime.dialog &&
    !session.page.isClosed()
  ) {
    session.max_steps = Math.max(session.max_steps, session.step_count + 1);
    await hauntAct(manager, {
      session_id: session.id,
      actions: [{ type: 'resize', width: NARROW.width, height: NARROW.height }],
    }).catch(() => {});
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
