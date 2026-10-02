// mcp-server/src/gates/part-1/contract.ts
//
// The interface part 1 has to deliver, as types. docs/v3/part-1-actions.md
// says what the tools must do; this says what they must look like, so the
// gate can be written before the implementation and the implementation can
// be checked against it by the compiler.

// ---------------------------------------------------------------------------
// haunt_capture_state
// ---------------------------------------------------------------------------

export interface CaptureInput {
  session_id: string;
  // 'text' is what a model reads; 'json' is the same snapshot as data, never
  // paged, for callers that process it.
  format?: 'text' | 'json';
  // Only what changed since this session's previous snapshot.
  diff?: boolean;
  // Limit to the subtree of one element.
  within?: string;
  actionable_only?: boolean;
  // Text format only: which page of a snapshot that exceeded the budget.
  page?: number;
  // Extra attributes to report per element (e.g. data-testid).
  include_attributes?: string[];
}

// Upper bound for one page of the text format, in characters.
export const SNAPSHOT_CHAR_BUDGET = 12_000;

// In the text format every element line carries its reference as "[e12]".
export const REF_IN_TEXT = /\[(e\d+)\]/g;

export interface ScrollState {
  x: number;
  y: number;
  // How far it can still go: y of max_y means the bottom is reached.
  max_x: number;
  max_y: number;
}

export type HiddenReason = 'display' | 'visibility' | 'zero_size';

export interface SnapshotElement {
  ref: string;
  role: string;
  name: string;
  tag: string;
  // Ids of the frames and shadow roots it sits in, outermost first.
  path: string[];
  value?: string;
  placeholder?: string;
  input_type?: string;
  href?: string;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  required?: boolean;
  invalid?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  // Outside the viewport (or outside its scroll container's visible area).
  offscreen?: boolean;
  // Ref of the element that would receive a click aimed at this one.
  covered_by?: string;
  hidden?: HiddenReason;
  // Laid out and visible, but a click there goes to whatever is behind it.
  unclickable?: 'pointer_events';
  // Present on scrollable containers.
  scroll?: ScrollState;
  // Appeared since the previous snapshot.
  is_new?: boolean;
  attributes?: Record<string, string>;
}

export interface SnapshotContainer {
  id: string;
  kind: 'frame' | 'shadow';
  // Containers it is nested in, outermost first.
  path: string[];
  url?: string;
  mode?: 'open' | 'closed';
}

export interface SnapshotDiff {
  added: SnapshotElement[];
  // Refs that no longer exist.
  removed: string[];
  // Elements whose reported fields changed, in their new state. Fields that
  // only say where an element is (offscreen, covered_by, scroll) do not count.
  changed: SnapshotElement[];
}

export interface Snapshot {
  url: string;
  title: string;
  // The text rendering (one page of it when it exceeds the budget).
  text: string;
  // format: 'json' only.
  elements?: SnapshotElement[];
  containers?: SnapshotContainer[];
  // diff: true only.
  diff?: SnapshotDiff;
  scroll: ScrollState;
  tabs: Array<{ index: number; title: string; url: string; active: boolean }>;
  dialog?: {
    type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
    message: string;
  };
  // Text format, when the snapshot did not fit in one page.
  truncated?: { page: number; pages: number; elements_remaining: number };
}

// ---------------------------------------------------------------------------
// haunt_act
// ---------------------------------------------------------------------------

export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

export type Action =
  | {
      type: 'click';
      ref: string;
      button?: 'left' | 'right' | 'middle';
      count?: 1 | 2 | 3;
      modifiers?: Modifier[];
    }
  | {
      type: 'fill';
      ref: string;
      text: string;
      clear?: boolean;
      submit?: boolean;
    }
  | { type: 'type'; ref?: string; text: string; delay_ms?: number }
  | { type: 'press'; keys: string | string[]; ref?: string }
  | { type: 'select'; ref: string; values: string[] }
  | { type: 'options'; ref: string }
  | { type: 'check'; ref: string; checked: boolean }
  | { type: 'hover'; ref: string }
  | {
      type: 'scroll';
      direction: 'up' | 'down' | 'left' | 'right';
      // Pixels; omitted means one page.
      amount?: number;
      ref?: string;
    }
  | { type: 'scroll_to'; ref?: string; text?: string }
  | {
      type: 'drag';
      from_ref: string;
      to_ref?: string;
      // Pixels from the centre of to_ref, or of from_ref without one.
      offset?: { x: number; y: number };
    }
  | { type: 'upload'; ref: string; files: string[] }
  | { type: 'goto'; url: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | {
      type: 'wait_for';
      text?: string;
      ref?: string;
      gone?: string;
      url?: string;
      ms?: number;
      timeout_ms?: number;
    }
  | {
      type: 'tab';
      op: 'switch' | 'close' | 'new';
      index?: number;
      url?: string;
    }
  | { type: 'dialog'; accept: boolean; text?: string }
  | { type: 'resize'; width: number; height: number }
  | { type: 'read'; ref?: string };

export const ACTION_TYPES = [
  'click',
  'fill',
  'type',
  'press',
  'select',
  'options',
  'check',
  'hover',
  'scroll',
  'scroll_to',
  'drag',
  'upload',
  'goto',
  'back',
  'forward',
  'reload',
  'wait_for',
  'tab',
  'dialog',
  'resize',
  'read',
] as const satisfies ReadonlyArray<Action['type']>;

export const FAILURE_CODES = [
  'stale_ref',
  'unknown_ref',
  'covered',
  'disabled',
  'not_visible',
  'not_editable',
  'no_such_option',
  'not_a_file_input',
  'dialog_open',
  'no_dialog',
  'timeout',
  'navigation_failed',
  'sandbox_blocked',
  'invalid_action',
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

// Failures that are known without waiting on the page (R-D2: under 200 ms).
export const IMMEDIATE_FAILURES: FailureCode[] = [
  'unknown_ref',
  'stale_ref',
  'disabled',
  'not_editable',
  'invalid_action',
  'no_dialog',
];

export interface ActionError {
  code: FailureCode;
  message: string;
  // stale_ref: the ref of an equivalent element that exists now, if any.
  similar_ref?: string;
  // covered: what is in the way.
  covered_by?: string;
  // not_visible
  reason?: HiddenReason;
  // not_editable
  role?: string;
  // no_such_option
  options?: string[];
  // dialog_open
  dialog?: { type: string; message: string };
  // timeout: what was there instead.
  observed?: string;
  // navigation_failed
  status?: number | string;
  // sandbox_blocked: without its query string.
  blocked?: string;
  // invalid_action
  parameter?: string;
}

export interface ActionChanges {
  url_before: string;
  url_after: string;
  // A document was loaded or the URL changed (pushState and hash included).
  navigated: boolean;
  // Indexes into the tab list.
  tabs_opened: number[];
  tabs_closed: number[];
  dialog?: { type: string; message: string };
  download?: { filename: string };
  focus_moved: boolean;
  // The snapshot differs from the one before the action.
  dom_changed: boolean;
  // Nothing a user would notice: no navigation, tab, dialog, download or
  // change to the page. Focus moving to the clicked control does not count.
  none: boolean;
}

// However busy the page stays, an action returns within this long after it
// was performed (R-C4).
export const SETTLE_CAP_MS = 5_000;

export interface StepResult {
  type: Action['type'];
  ok: boolean;
  error?: ActionError;
  changes: ActionChanges;
  // False when the settle cap was hit while the page was still busy.
  settled: boolean;
  // What was still in flight then.
  pending?: string[];
  action_ms: number;
  settle_ms: number;
  // options
  options?: Array<{
    label: string;
    value: string;
    selected: boolean;
    disabled: boolean;
  }>;
  // read
  text?: string;
}

export type StopReason =
  | 'failed'
  | 'navigated'
  | 'dialog'
  | 'tab'
  | 'step_limit';

export interface ActInput {
  session_id: string;
  actions: Action[];
}

export interface ActResult {
  // One entry per action that was executed, in order.
  results: StepResult[];
  executed: number;
  requested: number;
  // Present when fewer actions ran than were requested.
  stopped?: StopReason;
  url: string;
  title: string;
  // What the snapshot looks like now, relative to before the call.
  diff: SnapshotDiff;
  console_errors: string[];
  network_errors: string[];
  sandbox_blocked?: string[];
  step: number;
  steps_remaining: number;
}
