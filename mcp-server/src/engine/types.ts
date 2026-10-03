import type { Browser, BrowserContext, Page } from 'playwright';
import type { Signal } from '../gates/part-2/contract.js';
import type { Observation } from '../gates/part-3/contract.js';
import type { SessionRuntime } from './act/runtime.js';
import type { Recording } from './evidence/recording.js';
import type { SignalCollector } from './signals/collector.js';
import type { SnapshotState } from './snapshot/snapshot.js';

// What haunt_spawn accepts as cookies.
export type SpawnCookies = Parameters<BrowserContext['addCookies']>[0];

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';
export type IssueCategory =
  | 'ux'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'content';

export interface Issue {
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  page_url: string;
  screenshot_path?: string;
  recommendation: string;
  // The id of the signal this issue is about (part 2, R-S21): the report
  // shows the signal under the issue instead of on its own.
  signal?: string;
  // A fact about the page the engine can read back (part 3, R-E1).
  observed?: Observation;
}

export interface PersonaScenario {
  name: string;
  goal: string;
  max_steps: number;
}

export interface PersonaConfig {
  name: string;
  description: string;
  system_prompt: string;
  browser: {
    headless: boolean;
    viewport?: { width: number; height: number };
    locale?: string;
  };
  scenarios: PersonaScenario[];
}

export interface HauntSession {
  id: string;
  persona: PersonaConfig;
  browser: Browser;
  page: Page;
  issues: Issue[];
  pages_visited: string[];
  start_time: number;
  last_activity: number;
  step_count: number;
  max_steps: number;
  // Total wall-clock budget since spawn, regardless of activity — distinct
  // from the idle-based SESSION_TTL_MS reaping. Defaults to
  // SESSION_MAX_ACTIVE_DURATION_MS; overridable per session.
  max_active_duration_ms: number;
  // Mutable arrays — errors are captured via Playwright events and spliced out per step
  console_errors: string[];
  network_errors: string[];
  // Requests the sandbox blocked because their origin was never seen during
  // the target page's own initial load. Kept separate from network_errors —
  // a sandbox block is not an app failure and must never be reported as one.
  sandbox_blocked_requests: string[];
  // References issued so far and the previous snapshot, for diffs.
  snapshot: SnapshotState;
  // Tabs, requests in flight, downloads and the open dialog.
  runtime: SessionRuntime;
  // What the page did wrong that needs no judgement (part 2). `signals` is
  // the collector's own list, as raised.
  collector: SignalCollector;
  signals: Signal[];
  // Every action that ran, replayable in another browser (part 3).
  recording: Recording;
  evidence: {
    // Whether pages are audited for accessibility (a replay's are not).
    audit: boolean;
    replay_budget_ms: number;
    bundle_cap_bytes: number;
    // Kept in memory for the replays, never written.
    cookies?: SpawnCookies;
  };
}
