// mcp-server/src/engine/plan/plan.ts
//
// The plan of a session (part 4): what its pages offer, the test cases a
// tester registered, and how much of both has been done. Specified in
// docs/v3/part-4-tester.md; the shapes are fixed by gates/part-4/contract.ts.
//
// The engine keeps it, and the model fills it in. A model's own account of
// what it tested is what the pilot on CATTest showed to be worth nothing: it
// wrote "search works" after typing junk into it. Coverage is counted here,
// from the actions that ran.
import type { SnapshotElement } from '../../gates/part-1/contract.js';
import type {
  CaseStatus,
  CaseVerdict,
  ControlName,
  Coverage,
  InventoryControl,
  PlanCase,
  PlanInput,
  PlanOutput,
} from '../../gates/part-4/contract.js';
import { CASE_KINDS } from '../../gates/part-4/contract.js';
import { groupsOf } from '../act/page-fns.js';
import { SESSION_TTL_MS } from '../constants.js';
import { REF_FIELDS } from '../evidence/recording.js';
import { sabotaged } from '../sabotage.js';
import type { SessionManager } from '../session/manager.js';
import { takeSnapshot } from '../snapshot/snapshot.js';
import type { HauntSession } from '../types.js';

type Listed = Omit<InventoryControl, 'planned'>;

export interface PlanState {
  // Every control the session was shown, in the order it met them.
  controls: Map<string, Listed>;
  cases: Map<string, CaseStatus>;
  // For a case the engine gave a verdict to: the expectation it checked and
  // the step it checked it after, as a replay can check it again (R-T10).
  claims: Map<string, { step: number; observed: Record<string, unknown> }>;
  // Attack payloads may be planned (R-T14).
  hostile: boolean;
  // The last action that named a control, and how many times in a row it
  // has left the page as it was (R-T16).
  repeat: { key: string; times: number };
}

export function newPlanState(hostile: boolean): PlanState {
  return {
    controls: new Map(),
    cases: new Map(),
    claims: new Map(),
    hostile,
    repeat: { key: '', times: 0 },
  };
}

function stateOf(element: SnapshotElement): InventoryControl['state'] {
  if (element.hidden) return 'hidden';
  if (element.disabled) return 'disabled';
  if (element.covered_by) return 'covered';
  return undefined;
}

// Brings the inventory up to the page as it was last read. Returns the
// controls a user can act on now and could not when it was last brought up
// to date: new ones, and ones that were hidden, disabled or covered (R-T3).
export async function syncInventory(
  session: HauntSession,
): Promise<Array<{ ref: string; role: string; name: string }>> {
  const { plan, snapshot } = session;
  if (!snapshot.previous) {
    await takeSnapshot(session, { format: 'json' }, true).catch(() => {});
  }
  const elements = snapshot.previous?.elements ?? [];
  const first = plan.controls.size === 0;

  // The group of a control does not change; it is asked of the page once.
  const unknown = elements.filter((e) => !plan.controls.has(e.ref));
  const groups = new Map<string, string>();
  const byFrame = new Map<
    NonNullable<ReturnType<typeof snapshot.targets.get>>['frame'],
    Array<{ ref: string; doc: string; local: number }>
  >();
  for (const element of unknown) {
    const target = snapshot.targets.get(element.ref);
    if (!target) continue;
    const list = byFrame.get(target.frame) ?? [];
    list.push({ ref: element.ref, doc: target.doc, local: target.local });
    byFrame.set(target.frame, list);
  }
  await Promise.all(
    [...byFrame].map(async ([frame, targets]) => {
      if (frame.isDetached()) return;
      const found = await frame.evaluate(groupsOf, targets).catch(() => ({}));
      for (const [ref, group] of Object.entries(
        found as Record<string, string>,
      )) {
        groups.set(ref, group);
      }
    }),
  );

  const usable: Array<{ ref: string; role: string; name: string }> = [];
  for (const element of elements) {
    const state = stateOf(element);
    const known = plan.controls.get(element.ref);
    if (state === 'hidden' && !known && sabotaged('tester_hidden_dropped')) {
      continue;
    }
    if (!state && (!known || known.state) && !first) {
      usable.push({ ref: element.ref, role: element.role, name: element.name });
    }
    const listed: Listed = {
      ref: element.ref,
      role: element.role,
      name: element.name,
      group: known?.group ?? groups.get(element.ref) ?? 'page',
      exercised: known?.exercised ?? false,
    };
    if (state) listed.state = state;
    plan.controls.set(element.ref, listed);
  }
  return usable;
}

// The controls an action that succeeded named are exercised (R-T4).
export function markExercised(session: HauntSession, action: unknown): void {
  if (!action || typeof action !== 'object') return;
  for (const field of REF_FIELDS) {
    const ref = (action as Record<string, unknown>)[field];
    const control =
      typeof ref === 'string' ? session.plan.controls.get(ref) : undefined;
    if (control) control.exercised = true;
  }
}

// Whether this action, on a control, has now left the page as it was three
// times or more in a row (R-T16).
export function repeats(
  session: HauntSession,
  action: unknown,
  unchanged: boolean,
): number {
  const named =
    action &&
    typeof action === 'object' &&
    REF_FIELDS.some(
      (f) => typeof (action as Record<string, unknown>)[f] === 'string',
    );
  if (!named) return 0;
  const { repeat } = session.plan;
  const key = JSON.stringify(action);
  if (key !== repeat.key) {
    repeat.key = key;
    repeat.times = 0;
  }
  repeat.times = unchanged ? repeat.times + 1 : 0;
  return repeat.times;
}

export function coverageOf(session: HauntSession): Coverage {
  const { plan } = session;
  const controls = [...plan.controls.values()];
  const cases = [...plan.cases.values()];
  const named = new Set(cases.flatMap((one) => one.controls));
  const done = (control: Listed) =>
    control.exercised ||
    (sabotaged('tester_coverage_by_plan') && named.has(control.ref));
  return {
    controls: {
      listed: controls.length,
      exercised: controls.filter(done).length,
    },
    cases: {
      planned: cases.length,
      run: cases.filter((one) => one.verdict).length,
      passed: cases.filter((one) => one.verdict === 'passed').length,
      failed: cases.filter((one) => one.verdict === 'failed').length,
    },
    left: {
      controls: controls
        .filter((control) => !done(control))
        .map(({ ref, role, name }) => ({ ref, role, name })),
      cases: cases.filter((one) => !one.verdict).map((one) => one.id),
    },
  };
}

export function planOf(session: HauntSession): PlanOutput {
  const cases = [...session.plan.cases.values()];
  const named = new Set(cases.flatMap((one) => one.controls));
  return {
    inventory: [...session.plan.controls.values()].map((control) => ({
      ...control,
      planned: named.has(control.ref),
    })),
    cases,
    coverage: coverageOf(session),
    // By what each control is: a reference means nothing to another session
    // (R-T21).
    portable: cases.map(({ id, kind, controls, expect }) => ({
      id,
      kind,
      controls: controls.flatMap((ref) => {
        const control = session.plan.controls.get(ref);
        return control
          ? [{ role: control.role, name: control.name, group: control.group }]
          : [];
      }),
      expect,
    })),
  };
}

// The case with its controls as references of this session. One given by
// what it is must be a control of the inventory, and only one.
function resolved(session: HauntSession, one: GivenCase): PlanCase {
  const controls = one.controls.map((control) => {
    if (typeof control === 'string') return control;
    const found = [...session.plan.controls.values()].filter(
      (c) =>
        c.role === control.role &&
        c.name === control.name &&
        c.group === control.group,
    );
    if (found.length !== 1) {
      throw new Error(
        `Case "${one.id}" names the ${control.role} "${control.name}" (${control.group}), which ${found.length === 0 ? 'is not a control of this session' : `${found.length} controls of this session match`}. Plan it from this session's inventory.`,
      );
    }
    return found[0].ref;
  });
  return { id: one.id, kind: one.kind, controls, expect: one.expect };
}

// Gives a case its verdict.
export function closeCase(
  session: HauntSession,
  id: string,
  verdict: CaseVerdict,
  by: 'engine' | 'tester',
  detail: { step?: number; read?: unknown; note?: string },
): void {
  const one = session.plan.cases.get(id);
  if (!one)
    throw new Error(
      `No case "${id}" in the plan. Register it with haunt_plan first.`,
    );
  one.verdict = verdict;
  one.by = by;
  one.step = detail.step;
  one.read = detail.read;
  one.note = detail.note;
  for (const key of ['step', 'read', 'note'] as const) {
    if (one[key] === undefined) delete one[key];
  }
}

function checkCase(session: HauntSession, one: PlanCase): void {
  if (!(CASE_KINDS as readonly string[]).includes(one.kind)) {
    throw new Error(`Case "${one.id}" has an unknown kind "${one.kind}".`);
  }
  if (one.kind === 'hostile' && !session.plan.hostile) {
    throw new Error(
      `Case "${one.id}" is hostile: attack payloads are only planned in a session spawned with hostile: true, against an app you own.`,
    );
  }
  for (const ref of one.controls) {
    if (!session.plan.controls.has(ref)) {
      throw new Error(
        `Case "${one.id}" names ${ref}, which is not a control of this session. Use references from the inventory.`,
      );
    }
  }
  const known = session.plan.cases.get(one.id);
  if (known?.verdict) {
    throw new Error(
      `Case "${one.id}" already has a verdict (${known.verdict}); register the new one under another id.`,
    );
  }
}

// A case as it may be given: each control a reference of this session, or
// what it is. The contract's two forms, and any mix of them.
type GivenCase = Omit<PlanCase, 'controls'> & {
  controls: Array<string | ControlName>;
};

export async function hauntPlan(
  manager: SessionManager,
  input: Omit<PlanInput, 'cases'> & { cases?: GivenCase[] },
): Promise<PlanOutput> {
  const session = manager.get(input.session_id);
  await manager.reapStale(SESSION_TTL_MS);
  // The page as it is now: a plan made on what was read a minute ago would
  // miss what an action has brought since.
  if (!session.runtime.dialog) {
    await takeSnapshot(session, { format: 'json' }, true).catch(() => {});
  }
  await syncInventory(session);

  // All of them or none: a plan half taken is not the plan that was sent.
  const cases = (input.cases ?? []).map((one) => resolved(session, one));
  for (const one of cases) checkCase(session, one);
  for (const one of input.close ?? []) {
    if (
      !session.plan.cases.has(one.id) &&
      !cases.some((c) => c.id === one.id)
    ) {
      throw new Error(`No case "${one.id}" in the plan.`);
    }
  }
  for (const one of cases) {
    session.plan.cases.set(one.id, {
      id: one.id,
      kind: one.kind,
      controls: [...one.controls],
      expect: one.expect,
    });
  }
  for (const one of input.close ?? []) {
    closeCase(session, one.id, one.verdict, 'tester', { note: one.note });
  }
  return planOf(session);
}
