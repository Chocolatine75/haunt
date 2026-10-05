// mcp-server/src/gates/part-2/contract.ts
//
// The interface part 2 has to deliver, as types. docs/v3/part-2-signals.md
// says what a signal is and when one is raised; this fixes what it looks
// like and where it comes out, so the gate can be written first.
//
// Where the specification leaves a choice open, the choice is made here and
// marked "Decided here".
import type { ActResult, CaptureInput, Snapshot } from '../part-1/contract.js';

export const SIGNAL_KINDS = [
  'http_error',
  'request_failed',
  'request_hung',
  'slow_response',
  'js_exception',
  'unhandled_rejection',
  'console_error',
  'long_task',
  'dead_control',
  'a11y',
] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

// The engine never says `critical` (R-S3): that is a judgement.
export type SignalSeverity = 'major' | 'minor';

// What every signal carries (R-S1).
interface SignalBase {
  // "s1", "s2", … unique in the session and never reused: what an issue
  // names to say it is about this signal (R-S21).
  id: string;
  kind: SignalKind;
  // The page it happened on, without its query string or fragment (R-S18).
  url: string;
  // The action that caused it, counted as haunt_act counts steps; 0 for the
  // initial load (R-S6).
  step: number;
  // One line a person can read.
  message: string;
  severity: SignalSeverity;
  // How many times it happened (R-S13). Decided here: two occurrences are
  // the same signal when kind, step, message and the fields of the kind are
  // equal. The same failure caused by two different actions is two signals,
  // since each belongs to its own step.
  count: number;
  // Delivered after the result of the action that caused it (R-S7).
  late?: true;
}

interface RequestFields {
  method: string;
  // Without its query string (R-S18).
  request_url: string;
}

// Whether any text appeared on the page during the action (R-S5). Absent on
// a signal of the initial load.
interface Feedback {
  feedback?: boolean;
}

export interface HttpErrorSignal extends SignalBase, RequestFields, Feedback {
  kind: 'http_error';
  status: number;
  // As the browser names it: document, fetch, xhr, image, stylesheet, …
  resource_type: string;
  // A 401 or 403 answered while the session was not logged in (R-S14).
  while_logged_out?: true;
  // Such an answer to a request that carried a password typed in the
  // session, which the page then explained to the user (R-S14): a sign-in
  // refused as it should be. Still a signal; a report sets it aside.
  expected?: true;
}

export interface RequestFailedSignal
  extends SignalBase,
    RequestFields,
    Feedback {
  kind: 'request_failed';
  // The browser's error, e.g. net::ERR_EMPTY_RESPONSE.
  error: string;
}

export interface RequestHungSignal extends SignalBase, RequestFields {
  kind: 'request_hung';
  // How long it had gone unanswered when it was reported.
  duration_ms: number;
}

export interface SlowResponseSignal extends SignalBase, RequestFields {
  kind: 'slow_response';
  duration_ms: number;
}

export interface JsExceptionSignal extends SignalBase, Feedback {
  kind: 'js_exception';
  stack: string;
  // Where it was thrown; the URL without its query string.
  source: { url: string; line: number; column: number };
}

// `message` is the reason.
export interface UnhandledRejectionSignal extends SignalBase {
  kind: 'unhandled_rejection';
  stack: string;
}

// `message` is the text logged.
export interface ConsoleErrorSignal extends SignalBase {
  kind: 'console_error';
}

export interface LongTaskSignal extends SignalBase {
  kind: 'long_task';
  duration_ms: number;
}

// A click that changed nothing a user could notice and caused nothing else:
// a control whose click sends a request or throws is not dead, and what it
// caused is the signal.
export interface DeadControlSignal extends SignalBase {
  kind: 'dead_control';
  ref: string;
  role: string;
  name: string;
}

export interface A11ySignal extends SignalBase {
  kind: 'a11y';
  // axe-core's rule id and impact.
  rule: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  // How many elements break the rule, frames and shadow roots included.
  nodes: number;
  // Snapshot references of those that have one (R-S16).
  refs: string[];
  help: string;
}

export type Signal =
  | HttpErrorSignal
  | RequestFailedSignal
  | RequestHungSignal
  | SlowResponseSignal
  | JsExceptionSignal
  | UnhandledRejectionSignal
  | ConsoleErrorSignal
  | LongTaskSignal
  | DeadControlSignal
  | A11ySignal;

// R-S4.
export interface SignalThresholds {
  slow_response_ms: number;
  long_task_ms: number;
  hung_request_ms: number;
}

export const DEFAULT_THRESHOLDS: SignalThresholds = {
  slow_response_ms: 3_000,
  long_task_ms: 500,
  hung_request_ms: 10_000,
};

// ---------------------------------------------------------------------------
// Where signals come out
// ---------------------------------------------------------------------------

// Decided here: the engine's session object keeps the session's signals in
// `signals`, which is where part 1's harness reads them to check that the
// part 1 gate raises none (S2.3).
export interface SessionWithSignals {
  signals: Signal[];
}

// haunt_spawn: thresholds can be set for the session (R-S4).
export interface SpawnSignalsInput {
  signal_thresholds?: Partial<SignalThresholds>;
}

// Decided here: haunt_spawn returns the signals of the initial load (step
// 0), the first page's audit included, so that they reach the tester before
// its first action and are not delivered as late with it.
export interface SpawnSignalsOutput {
  session_id: string;
  signals: Signal[];
}

// haunt_act: the signals delivered with this call (R-S19). Those caused by
// its own actions, and those of earlier steps that had not been delivered,
// marked `late` (R-S7). A signal is delivered once.
export interface ActSignalsResult extends ActResult {
  signals: Signal[];
}

export interface CaptureSignalsInput extends CaptureInput {
  // Lists every signal raised so far on the current page (R-S19), delivered
  // before or not.
  signals?: boolean;
  // Audits the page as it is now, whether or not it was audited already
  // (R-S15). Implies `signals`.
  audit?: boolean;
}

export interface SnapshotWithSignals extends Snapshot {
  signals?: Signal[];
}

// haunt_end_session: every signal of the session (R-S8, R-S20).
export interface EndSessionSignalsOutput {
  session_id: string;
  step_count: number;
  issues_found: unknown[];
  sandbox_blocked_requests: string[];
  signals: Signal[];
}

// haunt_generate_report (R-S21): each session passes its signals; an issue
// names the signal it is about by its id.
export interface ReportIssueInput {
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: string;
  description: string;
  page_url: string;
  recommendation: string;
  signal?: string;
}

export interface ReportSessionInput {
  area: string;
  persona: string;
  overall_impression: string;
  issues: ReportIssueInput[];
  signals?: Signal[];
}

// The heading of the report's section for signals no issue names.
export const REPORT_SIGNALS_HEADING = 'Detected automatically';

// The report's JSON sidecar.
export interface ReportSidecar {
  issues: Array<ReportIssueInput & { signals?: Signal[] }>;
  // Every signal of every session, those named by an issue included.
  signals: Signal[];
  // Signals no issue names, counted by default severity.
  signal_counts: { total: number; major: number; minor: number };
}

// haunt-ci (R-S22): what runHeadlessTest returns says what the process must
// exit with. 1 for a critical or major issue, or a major signal.
export interface HeadlessVerdict {
  exitCode: 0 | 1;
}
