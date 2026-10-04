// mcp-server/src/test-support/gauntlet/evidence-routes.ts
//
// The server side of the gauntlet's evidence pages (part 3). Each route
// under /ev/ fails in one precise way, and works when the request carries
// ?variant=clean, as part 2's /sig/ routes do.
import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

// How many saves each run of ev-flaky has made: the run is named in the
// page's URL, so that a session and its replays share a count and two tests
// do not.
const saves = new Map<string, number>();

// The only credentials ev-login accepts. Not the login page's: a replay that
// mixes the two up must fail.
export const EV_LOGIN = {
  email: 'wraith@example.com',
  password: 'Moan 9+haunt',
};
const EV_COOKIE = 'ev_session';

// Every session cookie and bearer token ev-login has handed out. A signed-in
// response sets a new session cookie, as NextAuth's rolling sessions do: the
// value a host passed at spawn is not the one the server ends up sending, and
// a test looks for all of them.
const issued = new Set<string>();
function issue(): string {
  const value = randomBytes(16).toString('hex');
  issued.add(value);
  return value;
}
export function evIssued(): string[] {
  return [...issued];
}

function sessionOf(req: IncomingMessage): string | undefined {
  for (const pair of (req.headers.cookie ?? '').split(';')) {
    const [name, value] = pair.trim().split('=');
    if (name === EV_COOKIE && issued.has(value)) return value;
  }
  return undefined;
}
const sessionCookie = () => `${EV_COOKIE}=${issue()}; Path=/; HttpOnly`;

async function bodyOf(req: IncomingMessage): Promise<URLSearchParams> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return new URLSearchParams(body);
}

// Answers an /ev/ request. Returns false when the path is not one of them.
export async function handleEvidenceRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const path = url.pathname;
  if (!path.startsWith('/ev/')) return false;
  const buggy = url.searchParams.get('variant') !== 'clean';

  const json = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  // ev-sequence: fails only for a named order sent express.
  if (path === '/ev/api/order' && req.method === 'POST') {
    const form = await bodyOf(req);
    const failing =
      buggy && Boolean(form.get('name')) && form.get('shipping') === 'express';
    if (failing) json(500, { error: 'Internal Server Error' });
    else json(200, { ordered: true });
  }

  // ev-flaky: the first save of a run fails, then one in five: the 6th, the
  // 11th… A session sees the first; ten replays see two more.
  else if (path === '/ev/api/save' && req.method === 'POST') {
    const run = url.searchParams.get('run') ?? '';
    const n = (saves.get(run) ?? 0) + 1;
    saves.set(run, n);
    if (buggy && n % 5 === 1) json(500, { error: 'Internal Server Error' });
    else json(200, { saved: n });
  }

  // ev-frames: the frame's request and the shadow root's.
  else if (path === '/ev/api/quote') {
    json(buggy ? 500 : 200, buggy ? { error: 'Quote failed' } : { eur: 12 });
  } else if (path === '/ev/api/coupon') {
    json(buggy ? 500 : 200, buggy ? { error: 'Coupon failed' } : { off: 5 });
  }

  // ev-login
  else if (path === '/ev/api/login' && req.method === 'POST') {
    const form = await bodyOf(req);
    const ok =
      form.get('email') === EV_LOGIN.email &&
      form.get('password') === EV_LOGIN.password;
    res.writeHead(
      302,
      ok
        ? {
            'Set-Cookie': sessionCookie(),
            Location: `/ev-login?variant=${buggy ? 'buggy' : 'clean'}`,
          }
        : {
            Location: `/ev-login?variant=${buggy ? 'buggy' : 'clean'}&error=1`,
          },
    );
    res.end();
  } else if (path === '/ev/api/token' || path === '/ev/api/export') {
    // The page asks for a bearer token, then sends it with the export, as a
    // single-page app keeps a JWT: one more secret no field ever typed.
    const bearer = /^Bearer (\w+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!sessionOf(req)) json(401, { error: 'Unauthorized' });
    else {
      res.setHeader('Set-Cookie', sessionCookie());
      if (path === '/ev/api/token') {
        json(200, { token: issue(), user: { email: EV_LOGIN.email } });
      } else if (!bearer || !issued.has(bearer)) {
        json(401, { error: 'Unauthorized' });
      } else json(buggy ? 500 : 200, buggy ? { error: 'Export failed' } : {});
    }
  }

  // ev-long: deleting the last record fails.
  else if (path === '/ev/api/delete' && req.method === 'POST') {
    const record = Number(url.searchParams.get('record'));
    if (buggy && record === 200) json(500, { error: 'Internal Server Error' });
    else json(200, { deleted: record });
  } else {
    json(404, { error: 'Not found' });
  }
  return true;
}

// Whether a request carries ev-login's session cookie: the page renders
// differently for a signed-in visitor.
export function evSignedIn(req: IncomingMessage): boolean {
  return sessionOf(req) !== undefined;
}
