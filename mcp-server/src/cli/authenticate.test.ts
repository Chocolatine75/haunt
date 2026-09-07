import { type Server, createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionManager } from '../session/manager.js';
import { authenticate } from './authenticate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const VALID_PERSONA = resolve(
  __dirname,
  '../persona/__fixtures__/valid-persona.yaml',
);

// Chromium blocks script-initiated navigation TO a data: URL as a security
// measure, so "click leads to a different page" can't be exercised with
// data: URLs — a real (local) HTTP server is used instead.
const LOGIN_PAGE = `
  <input type="email" placeholder="Email" />
  <input type="password" placeholder="Password" />
  <button onclick="location.href='/dashboard'">Log in</button>
`;
// All four candidate labels are present (as no-ops) so each click resolves
// immediately instead of burning through navigate.ts's multi-role search
// timeouts for the labels that don't exist on the page.
const LOGIN_PAGE_NO_REDIRECT = `
  <input type="email" placeholder="Email" />
  <input type="password" placeholder="Password" />
  <button onclick="void 0">Log in</button>
  <button onclick="void 0">Sign in</button>
  <button onclick="void 0">Login</button>
  <button onclick="void 0">Submit</button>
`;
// A header nav link reading "Log in" (matching SUBMIT_BUTTON_LABELS' first
// candidate) that goes nowhere useful, alongside the real submit button
// under a different label — reproduces the real-world collision found
// against the demo app's own header nav.
const LOGIN_PAGE_WITH_DECOY = `
  <a href="/login-decoy">Log in</a>
  <input type="email" placeholder="Email" />
  <input type="password" placeholder="Password" />
  <button onclick="location.href='/dashboard'">Sign in</button>
`;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/login') {
      res.end(LOGIN_PAGE);
    } else if (req.url === '/login-fail') {
      res.end(LOGIN_PAGE_NO_REDIRECT);
    } else if (req.url === '/login-decoy') {
      res.end(LOGIN_PAGE_WITH_DECOY);
    } else if (req.url === '/dashboard') {
      res.end('<p>dashboard</p>');
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  return new Promise<void>((resolvePromise, reject) => {
    server.close((err) => (err ? reject(err) : resolvePromise()));
  });
});

describe('authenticate', () => {
  it('fills credentials, submits, and returns cookies after a redirect away from the login page', async () => {
    const manager = new SessionManager();

    const cookies = await authenticate(manager, {
      loginUrl: `${baseUrl}/login`,
      email: 'test@example.com',
      password: 'password123',
      headless: true,
      persona: VALID_PERSONA,
    });

    expect(Array.isArray(cookies)).toBe(true);
    expect(manager.all()).toHaveLength(0);
  }, 15_000);

  it('throws when the page never leaves the login URL (wrong credentials)', async () => {
    const manager = new SessionManager();

    await expect(
      authenticate(manager, {
        loginUrl: `${baseUrl}/login-fail`,
        email: 'wrong@example.com',
        password: 'wrong',
        headless: true,
        persona: VALID_PERSONA,
      }),
    ).rejects.toThrow(/did not leave the login route/);

    // Cleaned up (haunt_end_session) even though login failed.
    expect(manager.all()).toHaveLength(0);
  }, 40_000);

  it('skips a decoy element matching an earlier candidate label and finds the real submit button', async () => {
    const manager = new SessionManager();

    const cookies = await authenticate(manager, {
      loginUrl: `${baseUrl}/login-decoy`,
      email: 'test@example.com',
      password: 'password123',
      headless: true,
      persona: VALID_PERSONA,
    });

    expect(Array.isArray(cookies)).toBe(true);
  }, 20_000);
});
