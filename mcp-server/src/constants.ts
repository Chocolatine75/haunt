export const REPORTS_DIR = '.haunt-reports';
export const SCREENSHOTS_DIR = '.haunt-reports/screenshots';

// Screenshots older than this are purged on the next haunt_spawn call — nothing
// was cleaning this directory up before, so it grew without bound across runs.
export const SCREENSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

// A session whose browser sits idle longer than this (e.g. the orchestrator crashed
// or lost context before calling haunt_end_session) is reaped on the next tool call.
export const SESSION_TTL_MS = 10 * 60 * 1_000;
