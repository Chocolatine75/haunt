// mcp-server/src/test-support/gauntlet/signal-routes.ts
//
// The server side of the gauntlet's signal pages (part 2). Every route under
// /sig/ misbehaves in one precise way, and behaves when the request carries
// ?variant=clean: the two variants of a page make the same requests and only
// the answers differ.
import type { IncomingMessage, ServerResponse } from 'node:http';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Added to every planted delay, so that a duration measured from the browser
// side, where the clock starts a little later, is never under the delay the
// ground truth states.
const MARGIN_MS = 100;

// A 1x1 transparent PNG.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const doc = (title: string, back: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Gauntlet — ${title}</title><script src="/_g.js"></script></head><body><h1>${title}</h1><p><a data-g="back" href="${back}">Back</a></p></body></html>`;

// Answers a /sig/ request. Returns false when the path is not one of them.
export async function handleSignalRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const path = url.pathname;
  if (!path.startsWith('/sig/')) return false;
  const buggy = url.searchParams.get('variant') !== 'clean';

  const json = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  // The planted status in the buggy variant, 200 in the clean one.
  const failing = (status: number, error: string, ok: unknown) =>
    buggy ? json(status, { error }) : json(200, ok);

  // sig-http
  if (path === '/sig/api/orders') {
    failing(500, 'Internal Server Error', [{ id: 1, total: 120 }]);
  } else if (path === '/sig/api/profile') {
    failing(404, 'No such profile', { name: 'Ada' });
  } else if (path === '/sig/api/subscribe' && req.method === 'POST') {
    failing(422, 'Email already subscribed', { subscribed: true });
  } else if (path === '/sig/api/prices') {
    failing(500, 'Internal Server Error', { eur: 42 });
  } else if (path === '/sig/api/me') {
    // Answers 401 whatever the cookies: whether that is expected depends on
    // whether the session is logged in, which is not the server's to say.
    failing(401, 'Unauthorized', { email: 'ghost@example.com' });
  } else if (path === '/sig/doc/report') {
    res.writeHead(buggy ? 503 : 200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(doc(buggy ? 'Service unavailable' : 'Monthly report', '/sig-http'));
  } else if (path === '/sig/doc/guide') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(doc('Guide', '/sig-dead'));
  } else if (path === '/sig/asset/logo.png') {
    if (buggy) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Not found</h1>');
    } else {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(PIXEL);
    }
  } else if (path === '/sig/asset/theme.css') {
    // A 404 the way a real server sends it: an HTML page, which the browser
    // also refuses as a stylesheet in a second console line.
    if (buggy) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Not found</h1>');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end('h1 { letter-spacing: 0.01em; }');
    }
  }

  // sig-network
  else if (path === '/sig/api/drop') {
    if (buggy) req.socket.destroy();
    else json(200, { ok: true });
  } else if (path === '/sig/api/hang') {
    // Never answered; the connection ends when the browser or the server
    // closes it.
    if (!buggy) json(200, { ok: true });
  } else if (path === '/sig/api/report') {
    if (buggy) await sleep(4_000 + MARGIN_MS);
    json(200, { rows: 3 });
  } else if (path === '/sig/api/summary') {
    // Slow, but under the default threshold.
    if (buggy) await sleep(2_000 + MARGIN_MS);
    json(200, { total: 7 });
  } else if (path === '/sig/api/search') {
    // Long enough to be cancelled before it answers, in both variants.
    await sleep(3_000);
    json(200, { results: [] });
  }

  // sig-silent
  else if (path === '/sig/api/settings' && req.method === 'POST') {
    failing(500, 'Internal Server Error', { saved: true });
  }

  // sig-secrets
  else if (path === '/sig/api/session') {
    failing(500, 'Internal Server Error', { ok: true });
  } else if (path.startsWith('/sig/api/reset/')) {
    failing(404, 'Unknown reset token', { ok: true });
  } else {
    json(404, { error: 'Not found' });
  }
  return true;
}
