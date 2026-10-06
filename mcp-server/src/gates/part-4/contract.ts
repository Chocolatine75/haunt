// mcp-server/src/gates/part-4/contract.ts
//
// The interface part 4 has to deliver, as types. docs/v3/part-4-tester.md
// says what a plan, a case and an expectation are; this fixes what they look
// like and where they come out, so the gate can be written first.
//
// Where the specification leaves a choice open, the choice is made here and
// marked "Decided here".
import type { ActResult, Action } from '../part-1/contract.js';
import type { ActSignalsResult } from '../part-2/contract.js';
import type {
  ClaimedIssue,
  EndSessionEvidenceOutput,
  Observation,
  ReportEvidenceSession,
  ReportEvidenceSidecar,
  Verification,
} from '../part-3/contract.js';

// ---------------------------------------------------------------------------
// The plan (R-T1 … R-T4)
// ---------------------------------------------------------------------------

export const CASE_KINDS = [
  'normal',
  'edge',
  'state',
  'keyboard',
  'visual',
  // Attack payloads: planned only in a session spawned with `hostile`.
  'hostile',
] as const;

export type CaseKind = (typeof CASE_KINDS)[number];

// A control of the session's inventory (R-T1). Decided here: the inventory
// is the session's, not the page's. A control stays listed once seen, under
// the reference it had, so that coverage is of everything the session was
// shown.
export interface InventoryControl {
  ref: string;
  role: string;
  name: string;
  // Decided here: "<role>: <name>" of the nearest ancestor that is a form,
  // a search, a dialog, a group (fieldset), a region, a navigation, a
  // toolbar or a table and has an accessible name; "page" otherwise.
  group: string;
  // Why a user cannot act on it now. Absent when they can.
  state?: 'hidden' | 'disabled' | 'covered';
  // An action that succeeded named it (R-T4).
  exercised: boolean;
  // A case names it.
  planned: boolean;
}

// What the tester registers (R-T2).
export interface PlanCase {
  id: string;
  kind: CaseKind;
  // References from the inventory. May be empty for a case that only looks.
  controls: string[];
  // One sentence: what should be true once the case has been played.
  expect: string;
}

export type CaseVerdict = 'passed' | 'failed';

export interface CaseStatus extends PlanCase {
  verdict?: CaseVerdict;
  // Who gave it: the engine, by checking an expectation (R-T7), or the
  // tester, closing a case the engine cannot read.
  by?: 'engine' | 'tester';
  // The step whose expectation gave the verdict.
  step?: number;
  // What the engine read (R-T7), or the tester's sentence.
  read?: unknown;
  note?: string;
}

// R-T4. Counted by the engine from the actions it ran.
export interface Coverage {
  controls: { listed: number; exercised: number };
  cases: { planned: number; run: number; passed: number; failed: number };
  left: {
    // Listed and not exercised, whatever their state.
    controls: Array<{ ref: string; role: string; name: string }>;
    // Ids of the cases without a verdict.
    cases: string[];
  };
}

// haunt_plan. Decided here: one tool reads the plan and adds to it. With
// only a session id it returns the inventory, the cases and the coverage.
export interface PlanInput {
  session_id: string;
  // Cases to add. An id already used replaces that case if it has no
  // verdict, and is refused otherwise. A control is a reference of this
  // session, or what it is, as `portable` gives it (R-T21).
  cases?: Array<PlanCase | PortableCase>;
  // Cases the tester closes itself (R-T7).
  close?: Array<{ id: string; verdict: CaseVerdict; note: string }>;
}

export interface PlanOutput {
  inventory: InventoryControl[];
  cases: CaseStatus[];
  coverage: Coverage;
  // The cases as another session of the same page can register them
  // (R-T21).
  portable: PortableCase[];
}

// A control by what it is, which holds from one session to another where a
// reference does not.
export interface ControlName {
  role: string;
  name: string;
  group: string;
  // Which of the controls with that role, name and group, in the order the
  // inventory lists them, when there are several: every card of a list has
  // its own "Quick view". Absent when there is only one.
  index?: number;
}

export interface PortableCase extends Omit<PlanCase, 'controls'> {
  controls: ControlName[];
}

// ---------------------------------------------------------------------------
// Expectations (R-T7 … R-T9)
// ---------------------------------------------------------------------------

// The items of a container, read as the page shows them (R-T8). Decided
// here: the container is named by role and accessible name, not by
// reference, since a list is not a control and has none; the items are its
// descendants with the role `items`, in reading order, each read as its
// text, trimmed.
export interface ListQuery {
  within: { role: string; name: string };
  items: string;
}

// Every condition given must hold. `every_contains` and `none_contains`
// ignore case. A number is the first one written in the item ("$1,050.00"
// is 1050).
export interface ListCondition extends ListQuery {
  count?: { eq?: number; min?: number; max?: number };
  every_contains?: string;
  none_contains?: string;
  order?: 'ascending' | 'descending';
  // Default 'text'.
  as?: 'number' | 'text';
  // Exactly these items, in this order.
  equals?: string[];
}

// What a control holds (R-T9). Decided here: `focused` is among them, since
// where the keyboard is belongs to a control's state as much as `checked`.
export type ValueOf = 'value' | 'checked' | 'expanded' | 'pressed' | 'focused';

export interface ValueCondition {
  ref: string;
  of: ValueOf;
  // A credential field's value is compared as "(filled)" or "(empty)".
  is: string | boolean;
}

// Part 3's observation, with the two new kinds. Still exactly one of them.
export interface Expectation extends Observation {
  list?: ListCondition;
  value?: ValueCondition;
}

// What the engine made of an expectation.
export interface ExpectationResult {
  held: boolean;
  // The items of a list or the state of a control; absent for the
  // observations of part 3, which read nothing but yes or no.
  read?: unknown;
}

// ---------------------------------------------------------------------------
// haunt_spawn, haunt_act, haunt_capture_state
// ---------------------------------------------------------------------------

// Decided here: the budget of actions (R-T5) is the step limit the engine
// already had, under a name that says what it is. `timeout` stays accepted
// for it. Default 40. `persona` stays accepted and is ignored, as the
// earlier gates pass one.
export interface SpawnTesterInput {
  budget?: number;
  // Allows cases of kind `hostile` (R-T14).
  hostile?: boolean;
}

export interface ActTesterInput {
  session_id: string;
  actions: Action[];
  // The case these actions belong to, and what to check once the last of
  // them has settled (R-T7). An expectation without a case is checked and
  // reported, and gives no verdict.
  case?: string;
  expect?: Expectation;
}

export interface ActTesterResult extends ActSignalsResult {
  // What to do about an expectation that did not hold, in a sentence: file
  // it or state it again. A tester that is told nothing files nothing.
  todo?: string;
  // Present when `expect` was given and every action ran.
  expectation?: ExpectationResult;
  // Controls a user can act on now and could not before the call: new, or
  // no longer hidden (R-T3). Absent when there are none.
  new_controls?: Array<{ ref: string; role: string; name: string }>;
  // From three quarters of the budget (R-T6), and with `repeating`.
  remaining?: Coverage['left'];
  // The same action on the same control left the page unchanged this many
  // times, three or more (R-T16).
  repeating?: { times: number };
}

// `steps_remaining` of part 1 is what is left of the budget.
export type BudgetOf = Pick<ActResult, 'steps_remaining'>;

export interface CaptureTesterInput {
  // Returns the items of a container, as an expectation would read them.
  list?: ListQuery;
}

export interface CaptureTesterOutput {
  list?: string[];
}

// ---------------------------------------------------------------------------
// Issues, the session's result and the report (R-T10 … R-T12, R-T15)
// ---------------------------------------------------------------------------

// An issue can name a case whose check failed (R-T10), or carry an
// observation of the new kinds.
export interface TesterIssue extends Omit<ClaimedIssue, 'observed'> {
  observed?: Expectation;
  case?: string;
  // For an issue the engine cannot check (R-T11): what the tester expected
  // and what it saw, shown under "To check by hand".
  expected?: string;
  actual?: string;
}

// Decided here: `unchecked` joins part 3's statuses. An unchecked issue is
// in `issues_found`, like an unverified one, with the bundle of its steps.
export type TesterStatus = Verification['status'] | 'unchecked';

// Decided here: an issue naming a case the plan does not have, or one with
// no verdict, is rejected as `unknown_case`, as one naming a signal the
// session does not have is.
export interface TesterVerification
  extends Omit<Verification, 'status' | 'reason'> {
  status: TesterStatus;
  reason?: Verification['reason'] | 'unknown_case';
}

export interface VerifiedTesterIssue extends TesterIssue {
  verification: TesterVerification;
}

export interface EndSessionTesterOutput
  extends Omit<EndSessionEvidenceOutput, 'issues_found' | 'rejected'> {
  issues_found: VerifiedTesterIssue[];
  rejected: VerifiedTesterIssue[];
  cases: CaseStatus[];
  coverage: Coverage;
  // What the report merges sessions by (R-T22).
  inventory: InventoryControl[];
}

export const REPORT_UNCHECKED_HEADING = 'To check by hand';
// Decided here: the section says "<exercised> of <listed> controls" and
// "<passed> passed, <failed> failed, <n> not run", then names each control
// never exercised as `<role> "<name>"`.
export const REPORT_COVERAGE_HEADING = 'Coverage';

export interface ReportTesterSession
  extends Omit<ReportEvidenceSession, 'issues' | 'rejected' | 'persona'> {
  issues: VerifiedTesterIssue[];
  rejected?: VerifiedTesterIssue[];
  cases?: CaseStatus[];
  // As haunt_end_session returned them. Decided here: the report counts
  // from the inventories, not from each session's own coverage, so that two
  // sessions on one area count its controls once (R-T22): a control is the
  // same when area, group, role and name are.
  inventory?: InventoryControl[];
}

// The report's coverage: of the app, across its sessions.
export interface ReportCoverage {
  controls: { listed: number; exercised: number };
  cases: { planned: number; run: number; passed: number; failed: number };
  left: {
    controls: Array<{ area: string; role: string; name: string }>;
    cases: string[];
  };
}

// ---------------------------------------------------------------------------
// haunt-ci (R-T23)
// ---------------------------------------------------------------------------

// Decided here: what a brief starts with, so that who is being asked can be
// told from the prompt.
export const PLANNER_BRIEF_HEADING = '# Planner';
export const TESTER_BRIEF_HEADING = '# Tester';

// What a decision may carry besides its actions and issues: a plan, when
// asked for one; then the case its actions play and what it expects.
export interface DecisionTester {
  cases?: PlanCase[];
  case?: string;
  expect?: Expectation;
}

export interface ReportTesterInput {
  // The description of the app the tester was given, or its file's name
  // (R-T15).
  spec?: string;
}

export interface ReportTesterSidecar
  extends Omit<ReportEvidenceSidecar, 'issues'> {
  issues: VerifiedTesterIssue[];
  unchecked: VerifiedTesterIssue[];
  // Absent when no session carried an inventory.
  coverage?: ReportCoverage;
  spec?: string;
}
