// mcp-server/src/engine/sweep.ts
//
// The sweep (docs/v3/part-4-sweep.md): the buttons of an area that no
// tester pressed, pressed by the engine, each on the page as it loads. What
// breaks is found by the signals of part 2, which only ever looked at what
// something clicked: a planner plans what a page is for, a budget ends, and
// every run so far listed controls "never exercised". Whether pressing one
// does anything needs no model.
//
// It decides nothing a tester would have to judge: nothing in a form, and
// nothing whose name says it destroys.
import type { Signal } from '../gates/part-2/contract.js';
import type { InventoryControl } from '../gates/part-4/contract.js';
import { hauntAct } from './act/act.js';
import { sweptAround } from './act/page-fns.js';
import { hauntEndSession, lastEffects } from './end-session.js';
import { planOf, syncInventory } from './plan/plan.js';
import { sabotaged } from './sabotage.js';
import type { SessionManager } from './session/manager.js';
import { takeSnapshot } from './snapshot/snapshot.js';
import { hauntSpawn } from './spawn.js';
import type { SpawnInput } from './spawn.js';
import type { HauntSession } from './types.js';

// How many buttons a sweep presses unless told otherwise (R-W2).
export const SWEEP_MAX = 20;

// Names of what a sweep leaves alone (R-W2): it deletes, spends, sends or
// ends the session it runs in. A tester may decide to press one; something
// that asks nobody may not.
const DESTRUCTIVE =
  /\b(delete|remove|destroy|erase|wipe|deactivate|unsubscribe|log ?out|sign ?out|pay|buy|purchase|checkout|check out|place order|order now|send|publish|supprimer|effacer|déconnexion|se déconnecter|payer|acheter|commander|envoyer|publier)\b/i;

export interface SweepInput
  extends Pick<
    SpawnInput,
    | 'target_url'
    | 'headless'
    | 'cookies'
    | 'secrets'
    | 'replay_budget_ms'
    | 'bundle_cap_bytes'
  > {
  // Sessions of this area, live or ended: what they exercised is not
  // pressed again.
  sessions?: string[];
  max?: number;
}

type Around = 'in a form' | 'beside a field' | 'current';

interface Named {
  role: string;
  name: string;
  group: string;
}

export interface SweepOutput {
  // The sweep's own session, ended: what a report takes.
  session_id: string;
  pressed: Array<
    Named & {
      // Whether the press changed anything a user could notice.
      changed: boolean;
      // Ids of the signals it brought.
      signals: string[];
      // Why it could not be pressed, when it could not.
      error?: string;
    }
  >;
  left: Array<Named & { why: Around | 'destructive' | 'over the limit' }>;
  signals: Array<
    Pick<Signal, 'id' | 'kind' | 'message' | 'severity' | 'step'> & {
      status: string;
      name?: string;
    }
  >;
}

// What a control is from one session to another (R-T21).
const keyOf = (control: Named) =>
  JSON.stringify([control.group, control.role, control.name]);

// The buttons a user can press on the page as it is now, in reading order.
async function buttonsOf(
  session: HauntSession,
): Promise<Array<Named & { ref: string; around?: Around }>> {
  await takeSnapshot(session, { format: 'json' }, true);
  await syncInventory(session);
  const buttons = (session.snapshot.previous?.elements ?? []).filter(
    (element) =>
      element.role === 'button' &&
      !element.hidden &&
      !element.disabled &&
      !element.covered_by &&
      !element.unclickable,
  );
  const byFrame = new Map<
    NonNullable<ReturnType<typeof session.snapshot.targets.get>>['frame'],
    Array<{ ref: string; doc: string; local: number }>
  >();
  for (const { ref } of buttons) {
    const target = session.snapshot.targets.get(ref);
    if (!target) continue;
    const list = byFrame.get(target.frame) ?? [];
    list.push({ ref, doc: target.doc, local: target.local });
    byFrame.set(target.frame, list);
  }
  const around = new Map<string, Around>();
  await Promise.all(
    [...byFrame].map(async ([frame, targets]) => {
      if (frame.isDetached()) return;
      const found = await frame
        .evaluate(sweptAround, targets)
        .catch(() => ({}));
      for (const [ref, why] of Object.entries(found)) around.set(ref, why);
    }),
  );
  return buttons.map(({ ref, role, name }) => ({
    ref,
    role,
    name,
    group: session.plan.controls.get(ref)?.group ?? 'page',
    ...(around.has(ref) && !sabotaged('sweep_forms_included')
      ? { around: around.get(ref) }
      : {}),
  }));
}

export async function hauntSweep(
  manager: SessionManager,
  input: SweepInput,
): Promise<SweepOutput> {
  const { sessions = [], max = SWEEP_MAX, ...spawn } = input;

  const exercised = new Set<string>();
  for (const id of sessions) {
    const inventory = manager.has(id)
      ? planOf(manager.get(id)).inventory
      : (manager.endedSession(id)?.result.inventory as
          | InventoryControl[]
          | undefined);
    if (!inventory) {
      throw new Error(
        `No session ${id} to take what was exercised from: it never existed, or ended too long ago.`,
      );
    }
    for (const control of inventory) {
      if (control.exercised) exercised.add(keyOf(control));
    }
  }

  const { session_id } = await hauntSpawn(manager, {
    ...spawn,
    // A press, the area opened again, and at most a dialog to answer.
    budget: max * 3 + 3,
    // The testers' sessions audited this page and read its layout.
    audit: false,
    layout: false,
  });
  const session = manager.get(session_id);
  const act = (action: Record<string, unknown>) =>
    hauntAct(manager, { session_id, actions: [action] });

  const pressed: Array<SweepOutput['pressed'][number] & { step: number }> = [];
  const left = new Map<string, SweepOutput['left'][number]>();
  const done = new Set<string>();
  try {
    for (;;) {
      let next: (Named & { ref: string }) | undefined;
      for (const button of await buttonsOf(session)) {
        const key = keyOf(button);
        if (done.has(key) || exercised.has(key) || next) continue;
        const { ref, around, ...named } = button;
        const why = around
          ? around
          : DESTRUCTIVE.test(button.name)
            ? 'destructive'
            : pressed.length >= max
              ? 'over the limit'
              : undefined;
        if (why) left.set(key, { ...named, why });
        else next = button;
      }
      if (!next) break;

      const { ref, ...named } = next;
      done.add(keyOf(next));
      const result = await act({ type: 'click', ref });
      const step = result.results[0];
      pressed.push({
        ...named,
        changed: step.ok && !step.changes.none,
        signals: [],
        ...(step.error ? { error: step.error.code } : {}),
        step: result.step,
      });

      // The next one is pressed on the page a user opens, not on what this
      // one left (R-W3): behind a dialog nothing can be pressed, and on
      // another page there is nothing of this one. After every press, even
      // one that seemed to change nothing: on CATTest 43 the dots of a
      // section menu scrolled the page and moved its "active" mark without
      // changing an element, and the next button was pressed on that.
      const { runtime } = session;
      if (runtime.dialog) await act({ type: 'dialog', accept: false });
      while (runtime.tabs.length > 1) {
        await act({ type: 'tab', op: 'close', index: runtime.tabs.length - 1 });
      }
      const back = await act({ type: 'goto', url: input.target_url });
      if (!back.results[0]?.ok) break;
    }
  } catch (error) {
    if (manager.has(session_id)) {
      await session.browser.close().catch(() => {});
      manager.delete(session_id);
    }
    throw error;
  }

  // What the page raises as it loads it raised at step 0 (R-W4): raised
  // again later, by the area opened again or by a press that only scrolled
  // to a video its host refuses, it is not what a button did. Dropped once
  // the last of it has come.
  await lastEffects(session);
  for (let step = 1; step <= session.step_count; step++) {
    session.collector.forgetRepeats(0, step);
  }

  const dead = pressed.filter((one) => !one.changed && !one.error).length;
  const ended = await hauntEndSession(manager, {
    session_id,
    overall_impression: `Engine sweep: ${pressed.length} buttons no tester pressed were pressed; ${dead} changed nothing.`,
  });
  return {
    session_id,
    pressed: pressed.map(({ step, ...one }) => ({
      ...one,
      signals: ended.signals.filter((s) => s.step === step).map((s) => s.id),
    })),
    left: [...left.values()],
    signals: ended.signals.map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      message: signal.message,
      severity: signal.severity,
      step: signal.step,
      status: ended.signal_verification[signal.id]?.status ?? 'unverified',
      ...('name' in signal && typeof signal.name === 'string'
        ? { name: signal.name }
        : {}),
    })),
  };
}
