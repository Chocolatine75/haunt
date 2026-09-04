export const REPORTS_DIR = '.haunt-reports';
export const SCREENSHOTS_DIR = '.haunt-reports/screenshots';

// A session whose browser sits idle longer than this (e.g. the orchestrator crashed
// or lost context before calling haunt_end_session) is reaped on the next tool call.
export const SESSION_TTL_MS = 10 * 60 * 1_000;
