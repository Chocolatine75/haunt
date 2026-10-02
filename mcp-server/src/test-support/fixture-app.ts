// A tiny multi-page HTTP app for integration tests — real routes, a real form
// post, a real Set-Cookie, a real console error and a real failed request, so
// the tools are exercised against the same kinds of behavior they see in a
// user's app (unlike the data: URLs the unit tests use, which have no origin).
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FixtureApp {
  baseUrl: string;
  // Every "<METHOD> <path>" the app received, in order.
  requests: string[];
  close(): Promise<void>;
}

const HOME = `<!doctype html><html><head><title>Fixture Home</title></head><body>
<h1>Fixture app</h1>
<nav>
  <a href="/signup">Sign up</a>
  <a href="/broken">Broken page</a>
  <a href="/welcome">Welcome</a>
</nav>
</body></html>`;

const SIGNUP = `<!doctype html><html><head><title>Fixture Signup</title></head><body>
<h1>Create an account</h1>
<form method="post" action="/api/signup">
  <label>Email <input name="email" type="text" /></label>
  <label>Password <input name="password" type="password" /></label>
  <button type="submit">Create account</button>
</form>
</body></html>`;

// console.error + a subresource whose connection is destroyed server-side:
// one entry each for console_errors and network_errors.
const BROKEN = `<!doctype html><html><head><title>Fixture Broken</title></head><body>
<h1>Broken</h1>
<script>console.error('boom from fixture');</script>
<img src="/dead" alt="dead" />
</body></html>`;

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });
}

export async function startFixtureApp(): Promise<FixtureApp> {
  const requests: string[] = [];

  const server: Server = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    requests.push(`${req.method} ${path}`);

    if (path === '/dead') {
      req.socket.destroy();
      return;
    }
    if (path === '/api/signup' && req.method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      // The planted bug: an empty submission crashes instead of validating.
      if (!form.get('email')) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<title>Error</title><h1>Internal Server Error</h1>');
        return;
      }
      res.writeHead(302, {
        'Set-Cookie': 'sid=fixture-session; Path=/; HttpOnly',
        Location: '/welcome',
      });
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    if (path === '/') res.end(HOME);
    else if (path === '/signup') res.end(SIGNUP);
    else if (path === '/broken') res.end(BROKEN);
    else if (path === '/welcome') {
      res.end(
        `<!doctype html><title>Fixture Welcome</title><h1>Welcome</h1><p>cookie: ${req.headers.cookie ?? 'none'}</p>`,
      );
    } else {
      res.statusCode = 404;
      res.end('<title>Not found</title><h1>Not found</h1>');
    }
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    baseUrl,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  };
}
