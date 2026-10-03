// mcp-server/src/engine/signals/audit.ts
//
// The accessibility audit (R-S15 … R-S17): axe-core with the WCAG 2 A and AA
// rules, in every frame of the page, each offending element named by its
// snapshot reference when it has one.
//
// Each frame is audited on its own and the results put together by rule.
// axe-core's own ways of reaching into frames do not fit: messages between
// frames reach the page's message listeners, and its partial runs take
// several times longer and tens of megabytes on a large page.
import axe from 'axe-core';
import type { Frame } from 'playwright';
import type { Signal } from '../../gates/part-2/contract.js';
import { sabotaged } from '../sabotage.js';
import { knownRef } from '../snapshot/snapshot.js';
import type { HauntSession } from '../types.js';
import { auditDone, auditFrame } from './audit-page.js';

export interface Violation {
  rule: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  help: string;
  nodes: number;
  refs: string[];
}

const OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  resultTypes: ['violations'],
};

const IMPACTS = ['minor', 'moderate', 'serious', 'critical'];

// A frame that takes longer than this is left out rather than hold the
// session for ever.
const FRAME_MS = 60_000;

// axe-core, loaded into a document and taken off window at once: from then
// on it lives on the engine's own state, where no page script looks.
const LOAD = `(() => {
  const state = window.__haunt;
  if (!state || state.axe) return;
  const began = performance.now();
  const had = Object.getOwnPropertyDescriptor(window, 'axe');
  ${axe.source}
  state.axe = window.axe;
  if (had) Object.defineProperty(window, 'axe', had);
  else delete window.axe;
  try {
    const top = window.top.__haunt;
    const shift = performance.timeOrigin - window.top.performance.timeOrigin;
    top.work.push([began + shift, performance.now() + shift]);
  } catch {}
})()`;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), ms),
    ),
  ]);
}

async function auditOne(
  session: HauntSession,
  frame: Frame,
  top: boolean,
): Promise<Violation[]> {
  if (frame.isDetached()) return [];
  try {
    await withTimeout(frame.evaluate(LOAD), FRAME_MS);
    const found = await withTimeout(
      frame.evaluate(auditFrame, { options: OPTIONS, top }),
      FRAME_MS,
    );
    return (found ?? []).map((v) => ({
      rule: v.rule,
      impact: v.impact as Violation['impact'],
      help: v.help,
      nodes: v.nodes,
      refs: v.elements
        .map(([doc, local]) => knownRef(session, frame, doc, local))
        .filter((ref): ref is string => ref !== undefined),
    }));
  } finally {
    if (!frame.isDetached())
      await withTimeout(frame.evaluate(auditDone), 1_000);
  }
}

// Audits the page as it is now: every frame, one after another (they share
// the main thread), merged by rule.
export async function audit(session: HauntSession): Promise<Violation[]> {
  const page = session.page;
  if (page.isClosed() || session.runtime.dialog) return [];
  const byRule = new Map<string, Violation>();
  for (const frame of page.frames()) {
    for (const v of await auditOne(
      session,
      frame,
      frame === page.mainFrame(),
    )) {
      const known = byRule.get(v.rule);
      if (!known) {
        byRule.set(v.rule, { ...v });
        continue;
      }
      known.nodes += v.nodes;
      known.refs.push(...v.refs);
      if (IMPACTS.indexOf(v.impact) > IMPACTS.indexOf(known.impact)) {
        known.impact = v.impact;
      }
    }
  }
  return [...byRule.values()].map((v) => ({
    ...v,
    refs: [...new Set(v.refs)].sort(),
  }));
}

// The page a session is on, as the audit counts pages: origin and path.
function pageKey(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol)
      ? `${parsed.origin}${parsed.pathname}`
      : undefined;
  } catch {
    return undefined;
  }
}

// The pages each session has had audited.
const audited = new WeakMap<HauntSession, Set<string>>();

function seenBy(session: HauntSession): Set<string> {
  let seen = audited.get(session);
  if (!seen) {
    seen = new Set();
    audited.set(session, seen);
  }
  return seen;
}

// Audits the page as it is now and raises what it finds as signals of
// `step`; returns them, those the session already knew included.
export async function auditNow(
  session: HauntSession,
  step: number,
  options: { again?: boolean } = {},
): Promise<Signal[]> {
  const url = session.page.isClosed() ? '' : session.page.url();
  const key = pageKey(url);
  if (!key || session.runtime.dialog) return [];
  seenBy(session).add(key);
  return session.collector.fromAudit(url, step, await audit(session), options);
}

// Audits the page the session is on if it has not been yet in this session
// (R-S15).
export async function auditIfNew(
  session: HauntSession,
  step: number,
): Promise<void> {
  if (sabotaged('signals_no_audit') || sabotaged('signals_off')) return;
  if (session.page.isClosed()) return;
  const key = pageKey(session.page.url());
  if (!key) return;
  const again = sabotaged('signals_audit_every_action');
  if (seenBy(session).has(key) && !again) return;
  await auditNow(session, step, { again });
}
