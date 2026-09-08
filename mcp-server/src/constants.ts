export const REPORTS_DIR = '.haunt-reports';
export const SCREENSHOTS_DIR = '.haunt-reports/screenshots';

// Screenshots older than this are purged on the next haunt_spawn call — nothing
// was cleaning this directory up before, so it grew without bound across runs.
export const SCREENSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

// A session whose browser sits idle longer than this (e.g. the orchestrator crashed
// or lost context before calling haunt_end_session) is reaped on the next tool call.
export const SESSION_TTL_MS = 10 * 60 * 1_000;

// A session actively driven (not idle — see SESSION_TTL_MS above, which
// only catches idle sessions) past this total duration since spawn is
// refused further action. Distinct per-session override exists on
// HauntSession.max_active_duration_ms for callers that need a larger
// budget (e.g. a long, deliberately deep investigation).
export const SESSION_MAX_ACTIVE_DURATION_MS = 15 * 60 * 1_000;
