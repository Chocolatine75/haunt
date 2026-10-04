// mcp-server/src/gates/part-3/contract.ts
//
// The interface part 3 has to deliver, as types. docs/v3/part-3-evidence.md
// says what a claim, a replay and a bundle are; this fixes what they look
// like and where they come out, so the gate can be written first.
//
// Where the specification leaves a choice open, the choice is made here and
// marked "Decided here".
import type { Action } from '../part-1/contract.js';
import type { Signal } from '../part-2/contract.js';

// ---------------------------------------------------------------------------
// What an issue is about (R-E1, R-E2)
// ---------------------------------------------------------------------------

export type ElementState =
  | 'visible'
  | 'hidden'
  | 'disabled'
  | 'enabled'
  | 'gone';

// A fact about the page after a step, which the engine reads back by itself.
// Exactly one of the four.
export interface Observation {
  // The step after which it holds; the last step of the session if omitted.
  step?: number;
  text_present?: string;
  text_absent?: string;
  url?: string;
  element?: { ref: string; state: ElementState };
}

export type Severity = 'critical' | 'major' | 'minor' | 'suggestion';

// What a tester files, through haunt_act's or haunt_end_session's `issues`.
export interface ClaimedIssue {
  severity: Severity;
  category: 'ux' | 'accessibility' | 'performance' | 'security' | 'content';
  description: string;
  page_url: string;
  recommendation: string;
  // A signal of the session, by id.
  signal?: string;
  observed?: Observation;
}

// ---------------------------------------------------------------------------
// Verification (R-E8 … R-E12)
// ---------------------------------------------------------------------------

export type VerificationStatus =
  | 'confirmed'
  | 'flaky'
  | 'rejected'
  | 'unverified';

// Decided here: why an issue was rejected, as a code a report or a test can
// rely on.
export type RejectionReason =
  | 'no_claim'
  | 'unknown_signal'
  | 'not_reproduced'
  | 'not_replayable';

export interface Verification {
  status: VerificationStatus;
  // Replays run, and how many reproduced the claim.
  attempts: number;
  reproduced: number;
  // reproduced / attempts, for a flaky one; 1 for a confirmed one.
  rate: number;
  reason?: RejectionReason;
  // The step a replay could not run, for not_replayable.
  failed_step?: number;
  // Path of the bundle's directory (R-E13), for confirmed and flaky ones.
  bundle?: string;
}

export interface VerifiedIssue extends ClaimedIssue {
  verification: Verification;
}

// How each signal of the session was verified (R-E10), by its id. Decided
// here: kept beside the signals rather than in them, so that a signal is the
// same object in an action's result, the session's and the report's (part
// 2's S7.1).
export type SignalVerifications = Record<string, Verification>;

// haunt_spawn: how long a session's replays may take (R-E11), default
// 120000. Decided here: the size a bundle of this session may reach (R-E16),
// default BUNDLE_CAP_BYTES, so that the cap can be tested without writing
// megabytes.
export interface SpawnEvidenceInput {
  replay_budget_ms?: number;
  bundle_cap_bytes?: number;
}

// haunt_end_session (R-E17). Decided here: `issues_found` holds the issues
// that were not rejected, confirmed, flaky or unverified, and `rejected`
// the others; `signal_verification` how each signal fared.
export interface EndSessionEvidenceOutput {
  session_id: string;
  step_count: number;
  issues_found: VerifiedIssue[];
  rejected: VerifiedIssue[];
  sandbox_blocked_requests: string[];
  signals: Signal[];
  signal_verification: SignalVerifications;
}

// ---------------------------------------------------------------------------
// The bundle (R-E4 … R-E7, R-E13 … R-E16)
// ---------------------------------------------------------------------------

// How a replay finds the element an action named (R-E4).
export interface Locator {
  role: string;
  name: string;
  // Among the elements with this role, name and path, in reading order.
  index: number;
  // The frames and shadow roots on the way, outermost first: a frame by its
  // URL path and its index among the frames beside it with that path, a
  // shadow root by its index among the shadow roots beside it.
  path: Array<{ frame: string; index: number } | { shadow: number }>;
}

// One action as recorded: the action with its references taken out, and a
// locator for each.
export interface RecordedStep {
  step: number;
  action: Action;
  // Keyed by the action's field that held a reference: ref, from_ref, to_ref.
  locators: Record<string, Locator>;
}

// steps.json (R-E13): replayable with nothing else but the secrets.
export interface StepsFile {
  version: 1;
  start_url: string;
  viewport: { width: number; height: number };
  // The spawn options a replay must reuse (thresholds); never cookies.
  spawn: Record<string, unknown>;
  steps: RecordedStep[];
  // The claim, with the step it is about.
  claim:
    | { step: number; signal: Signal }
    | { step: number; observed: Observation };
  // Placeholders standing for typed secrets, by name: "{{secret:1}}".
  secrets: string[];
}

// verification.json
export type VerificationFile = Verification;

// The files of a bundle directory, beside signal.json for an issue about a
// signal. trace.zip and screenshot.png may be missing when the storage cap
// dropped them, and then verification.json says so.
export const BUNDLE_FILES = [
  'steps.json',
  'screenshot.png',
  'trace.zip',
  'network.json',
  'verification.json',
] as const;

// Decided here: what a bundle that dropped its trace says in
// verification.json.
export interface CappedVerification extends Verification {
  dropped?: Array<'trace' | 'screenshot'>;
}

export const BUNDLE_CAP_BYTES = 5 * 1024 * 1024;
export const REPORT_CAP_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Replaying a bundle (R-E14)
// ---------------------------------------------------------------------------

export interface ReplayInput {
  // A bundle directory or a steps.json file.
  bundle: string;
  // Values for the placeholders, by placeholder.
  secrets?: Record<string, string>;
  cookies?: unknown[];
}

export interface ReplayOutput {
  // Whether the claim held.
  reproduced: boolean;
  outcome: 'reproduced' | 'not_reproduced' | 'not_replayable';
  // For not_replayable: the step whose locator matched no element, or more
  // than one.
  failed_step?: number;
  // For a signal claim: the signal the replay raised, if any.
  signal?: Signal;
}

// ---------------------------------------------------------------------------
// The report (R-E12, R-E17)
// ---------------------------------------------------------------------------

export const REPORT_FLAKY_HEADING = 'Flaky';
export const REPORT_UNVERIFIED_HEADING = 'Unverified';

// haunt_generate_report: each session passes what haunt_end_session
// returned, as it came.
export interface ReportEvidenceSession {
  area: string;
  persona: string;
  overall_impression: string;
  issues: VerifiedIssue[];
  rejected?: VerifiedIssue[];
  signals?: Signal[];
  signal_verification?: SignalVerifications;
}

export interface ReportEvidenceSidecar {
  issues: VerifiedIssue[];
  flaky: VerifiedIssue[];
  unverified: VerifiedIssue[];
  rejected: VerifiedIssue[];
  signals: Signal[];
  signal_verification: SignalVerifications;
}
