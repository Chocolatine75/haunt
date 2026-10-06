// mcp-server/src/gates/part-4/harness.ts
//
// What every part 4 gate test stands on: part 3's harness (a haunt session
// driven only through the MCP tools, its issues verified), opened on a
// tester page, with the page's ground truth turned into what a tester
// sends: cases naming references, steps, and the expectation stated with
// the last of them.
//
// A result that lacks what part 4 adds is an error here, never a pass: a
// gate test must not pass because the feature is missing.
import { expect, it } from 'vitest';
import type {
  TesterPage,
  Variant,
} from '../../test-support/gauntlet/server.js';
import {
  type TesterCase,
  type TesterCheck,
  type TesterStep,
  type TesterTruth,
  loadTesterTruth,
} from '../../test-support/gauntlet/tester-truth.js';
import type { Action } from '../part-1/contract.js';
import type { Session } from '../part-1/harness.js';
import { type EvidenceContext, useEvidence } from '../part-3/harness.js';
import type {
  ActTesterResult,
  EndSessionTesterOutput,
  Expectation,
  PlanCase,
  PlanInput,
  PlanOutput,
  TesterIssue,
} from './contract.js';
import { PASSING } from './status.js';

export const TESTER = loadTesterTruth();

// Registers a gate test. `id` is its number in the spec's gate (T3.1),
// `requirements` the requirement ids it proves. Until the id is listed in
// status.ts the test is an expected failure.
export function gate(
  id: string,
  requirements: string,
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 120_000,
): void {
  const run = PASSING.has(id) ? it : it.fails;
  run(`${id} [${requirements}] ${name}`, fn, timeoutMs);
}

// A session on a tester page.
export class TesterSession {
  constructor(
    readonly ctx: EvidenceContext,
    readonly s: Session,
    readonly page: TesterPage,
    readonly variant: Variant,
    readonly url: string,
  ) {}

  get truth(): TesterTruth {
    return TESTER[this.page];
  }

  get id(): string {
    return this.s.id;
  }

  // haunt_plan, as it answers; an error is thrown with its text.
  async plan(input: Omit<PlanInput, 'session_id'> = {}): Promise<PlanOutput> {
    const result = await this.ctx.haunt.call<PlanOutput>('haunt_plan', {
      session_id: this.id,
      ...input,
    });
    if (result.isError) throw new Error(result.text);
    const { inventory, cases, coverage, portable } = result.data ?? {};
    if (
      !Array.isArray(inventory) ||
      !Array.isArray(cases) ||
      !Array.isArray(portable) ||
      !coverage
    ) {
      throw new Error(
        'haunt_plan returned no inventory, cases, portable cases or coverage',
      );
    }
    return result.data;
  }

  // The reference of the control carrying data-g="<g>".
  ref(g: string): Promise<string> {
    return this.s.ref(g);
  }

  // A case of the ground truth as a tester registers it.
  async caseOf(one: TesterCase): Promise<PlanCase> {
    return {
      id: one.id,
      kind: one.kind,
      controls: await Promise.all(one.controls.map((g) => this.ref(g))),
      expect: one.expect,
    };
  }

  // Registers the page's cases; returns the plan.
  async register(cases: TesterCase[] = this.truth.cases): Promise<PlanOutput> {
    return this.plan({
      cases: await Promise.all(cases.map((one) => this.caseOf(one))),
    });
  }

  // A check of the ground truth as an expectation: its control by reference.
  async expectation(check: TesterCheck): Promise<Expectation> {
    if (!check.value) return check as Expectation;
    const { target, ...rest } = check.value;
    return { value: { ref: await this.ref(target), ...rest } };
  }

  async action(step: TesterStep): Promise<Action> {
    if (step.type === 'press') return { type: 'press', keys: step.keys ?? '' };
    if (!step.target) throw new Error(`a ${step.type} needs a target`);
    const ref = await this.ref(step.target);
    if (step.type === 'click') return { type: 'click', ref };
    if (step.type === 'check') return { type: 'check', ref, checked: true };
    if (step.type === 'select')
      return { type: 'select', ref, values: step.values ?? [] };
    return { type: 'fill', ref, text: step.text ?? '' };
  }

  // haunt_act with what part 4 adds to its input. Every action must run.
  async act(
    actions: Action[],
    extra: { case?: string; expect?: Expectation } = {},
  ): Promise<ActTesterResult> {
    const result = await this.ctx.haunt.call<ActTesterResult>('haunt_act', {
      session_id: this.id,
      actions,
      ...extra,
    });
    if (result.isError) throw new Error(result.text);
    for (const [i, one] of result.data.results.entries()) {
      expect(one.ok, `action ${i + 1} (${one.type})`).toBe(true);
    }
    expect(result.data.executed).toBe(actions.length);
    return result.data;
  }

  // Plays a case as a tester does: its steps one call each, the case and
  // what it expects stated with the last. Returns that last result, which
  // must say what became of the expectation.
  async play(one: TesterCase): Promise<ActTesterResult> {
    let last: ActTesterResult | undefined;
    for (const [i, step] of one.steps.entries()) {
      const closing = i === one.steps.length - 1;
      last = await this.act(
        [await this.action(step)],
        closing
          ? { case: one.id, expect: await this.expectation(one.check) }
          : {},
      );
    }
    if (!last?.expectation) {
      throw new Error(`haunt_act said nothing of the expectation of ${one.id}`);
    }
    return last;
  }

  async playAll(): Promise<void> {
    for (const one of this.truth.cases) await this.play(one);
  }

  // Ends the session with these issues; returns what verification, the plan
  // and the coverage made of it.
  async end(issues: TesterIssue[] = []): Promise<EndSessionTesterOutput> {
    const result = await this.ctx.haunt.call<EndSessionTesterOutput>(
      'haunt_end_session',
      { session_id: this.id, issues },
    );
    if (result.isError) throw new Error(result.text);
    const ended = result.data;
    if (
      !ended.coverage ||
      !Array.isArray(ended.cases) ||
      !Array.isArray(ended.inventory)
    ) {
      throw new Error(
        'haunt_end_session returned no coverage, cases or inventory',
      );
    }
    for (const issue of [...ended.issues_found, ...ended.rejected]) {
      if (!issue.verification) throw new Error('an issue has no verification');
    }
    return ended;
  }

  // An issue about this page, to which a claim is added.
  issue(extra: Partial<TesterIssue> = {}): TesterIssue {
    return {
      severity: 'major',
      category: 'ux',
      description: 'Gate issue',
      page_url: this.url,
      recommendation: 'Fix it',
      ...extra,
    };
  }
}

export interface TesterContext extends EvidenceContext {
  // Opens a session on a tester page.
  qa(
    page: TesterPage,
    variant?: Variant,
    spawn?: Record<string, unknown>,
  ): Promise<TesterSession>;
}

// Call once at the top of a gate file's describe block.
export function useTester(): TesterContext {
  const context = useEvidence() as TesterContext;
  context.qa = async (page, variant = 'buggy', spawn = {}) => {
    const url = context.gauntlet.url(page, `variant=${variant}`);
    const opened = await context.openUrl(url, {
      timeout: 400,
      replay_budget_ms: 120_000,
      ...spawn,
    });
    return new TesterSession(context, opened, page, variant, url);
  };
  return context;
}

// The controls a scripted session of every case of a page exercises: those
// its steps name.
export function exercisedBy(truth: TesterTruth): string[] {
  return [
    ...new Set(
      truth.cases.flatMap((one) =>
        one.steps.flatMap((step) => (step.target ? [step.target] : [])),
      ),
    ),
  ];
}
