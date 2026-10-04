// mcp-server/src/engine/report/group.ts
//
// One problem, one entry. A run on demo/ listed the same 500 on /api/signup
// as two issues (two testers reached it by two routes) and the same contrast
// rule six times (once per page and session): the reader counted eight
// problems where there were two.

// What grouping reads of a signal; the fields of its kind are optional since
// a report can be handed any of them.
export interface GroupableSignal {
  kind: string;
  url: string;
  step: number;
  message: string;
  severity: 'major' | 'minor';
  count: number;
  method?: string;
  request_url?: string;
  status?: number;
  error?: string;
  rule?: string;
  help?: string;
  role?: string;
  name?: string;
}

// Two signals are the same problem when this is equal. A request is the
// same wherever it was sent from, and an axe rule is the same failure of the
// same stylesheet on every page. A dead control or a long task belongs to
// its page. Durations are left out: the same slow endpoint is not two
// problems because it took 3.2 s once and 4.1 s the next time.
export function signalKey(signal: GroupableSignal): string {
  // A signal handed over without its request (an older sidecar, a caller's
  // own) is told apart by what it says.
  const request = signal.request_url
    ? `${signal.method ?? ''} ${signal.request_url}`
    : `${signal.url} ${signal.message}`;
  switch (signal.kind) {
    case 'http_error':
      return `http_error|${request}|${signal.status ?? ''}`;
    case 'request_failed':
      return `request_failed|${request}|${signal.error ?? ''}`;
    case 'request_hung':
    case 'slow_response':
      return `${signal.kind}|${request}`;
    case 'js_exception':
    case 'unhandled_rejection':
    case 'console_error':
      return `${signal.kind}|${signal.message}`;
    case 'a11y':
      return `a11y|${signal.rule ?? signal.message}`;
    case 'dead_control':
      return `dead_control|${signal.url}|${signal.role ?? ''}|${signal.name ?? ''}`;
    case 'long_task':
      return `long_task|${signal.url}`;
    default:
      return `${signal.kind}|${signal.url}|${signal.message}`;
  }
}

// Groups in the order their first member came, members in theirs.
export function groupBy<T>(items: T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return [...groups.values()];
}

const PAGES_SHOWN = 5;

function pagesOf(signals: GroupableSignal[]): string {
  const pages = [...new Set(signals.map((s) => s.url))];
  const shown = pages
    .slice(0, PAGES_SHOWN)
    .map((p) => `\`${p}\``)
    .join(', ');
  const more = pages.length - PAGES_SHOWN;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

// One line for a group of signals that are the same problem: what it says,
// where, and how often.
export function renderSignalGroup(group: GroupableSignal[]): string {
  const [first] = group;
  const severity = group.some((s) => s.severity === 'major')
    ? 'major'
    : 'minor';
  const times = group.reduce((sum, s) => sum + s.count, 0);
  if (group.length === 1) {
    return `- [${severity.toUpperCase()}] ${first.message} — \`${first.url}\` (step ${first.step}${times > 1 ? `, ${times} times` : ''})`;
  }
  const pages = new Set(group.map((s) => s.url)).size;
  // An a11y message counts the elements of one page; the rule is what the
  // pages share.
  const message =
    first.kind === 'a11y' && first.help && pages > 1
      ? `${first.help} (on ${pages} pages)`
      : first.message;
  const steps = [...new Set(group.map((s) => s.step))].sort((a, b) => a - b);
  return `- [${severity.toUpperCase()}] ${message} — ${pagesOf(group)} (step${steps.length > 1 ? 's' : ''} ${steps.join(', ')}, ${times} time${times === 1 ? '' : 's'})`;
}
