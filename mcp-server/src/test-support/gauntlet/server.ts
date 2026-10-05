// mcp-server/src/test-support/gauntlet/server.ts
//
// The gauntlet: a deliberately hostile web app for the roadmap gates. Every
// page isolates one family of hard cases (shadow DOM, overlays, virtualised
// lists, ...) and records what really happened to it on window.__gauntlet,
// so a gate test can compare the tool's account with the page's own.
//
// Served on two origins so cross-origin frames are real. No framework and no
// network beyond 127.0.0.1.
import { readFileSync } from 'node:fs';
import {
  type IncomingMessage,
  type Server,
  type ServerResponse,
  createServer,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evSignedIn, handleEvidenceRoute } from './evidence-routes.js';
import { handleSignalRoute } from './signal-routes.js';

declare global {
  interface Window {
    // The page's own record of what happened to it (see runtime.js).
    // biome-ignore lint/suspicious/noExplicitAny: plain browser-side object
    __gauntlet: any;
  }
}

const HERE = fileURLToPath(new URL('.', import.meta.url));

// The huge page's 500 records, the same every time (pages/huge.html).
const hugeRecords = Array.from({ length: 500 }, (_, k) => {
  const i = k + 1;
  const spans = Array.from(
    { length: 40 },
    (_, j) => `<span>v${i}.${j + 1}</span>`,
  ).join('');
  return (
    `<div class="record"><a href="#record-${i}" data-g="link-${i}">Record ${i}</a>` +
    `<input type="text" data-g="note-${i}" aria-label="Note for record ${i}" size="8">` +
    `<input type="checkbox" data-g="select-${i}" aria-label="Select record ${i}">` +
    `<button type="button" data-g="archive-${i}" aria-label="Archive record ${i}">Archive</button>` +
    `${spans}</div>`
  );
}).join('');

export const GAUNTLET_PAGES = [
  'forms',
  'shadow',
  'frames',
  'selects',
  'overlays',
  'hover',
  'dnd',
  'upload',
  'scroll',
  'tabs',
  'dialogs',
  'dupes',
  'dynamic',
  'editor',
  'huge',
  'states',
  'spa',
  'escape',
  'login',
] as const;

export type GauntletPage = (typeof GAUNTLET_PAGES)[number];

// Part 2's pages. Each plants defects the engine has to detect by itself,
// and exists in two variants, ?variant=buggy (the default) and
// ?variant=clean, identical except for the defects. What each must and must
// not produce is in ground-truth.json. Kept apart from GAUNTLET_PAGES, which
// load without an error of any kind.
export const SIGNAL_PAGES = [
  'sig-http',
  'sig-exceptions',
  'sig-network',
  'sig-blocking',
  'sig-dead',
  'sig-a11y',
  'sig-silent',
  'sig-secrets',
] as const;

export type SignalPage = (typeof SIGNAL_PAGES)[number];

// Part 3's pages: failures a session finds and a replay has to find again,
// each in the two variants of part 2's pages. What a tester files on each is
// in evidence-truth.json.
export const EVIDENCE_PAGES = [
  'ev-sequence',
  'ev-flaky',
  'ev-late',
  'ev-silent',
  'ev-frames',
  'ev-login',
  'ev-long',
] as const;

export type EvidencePage = (typeof EVIDENCE_PAGES)[number];

// Part 4's pages: functional defects. The page answers, raises no signal,
// and is wrong; only a tester that states what it expects finds out. The
// same two variants; what each offers and what a correct tester checks on
// it is in tester-truth.json.
export const TESTER_PAGES = [
  'qa-search',
  'qa-filters',
  'qa-sort',
  'qa-form',
  'qa-rating',
  'qa-dialog',
] as const;

export type TesterPage = (typeof TESTER_PAGES)[number];
export type Variant = 'buggy' | 'clean';

export interface Gauntlet {
  // Origin the pages are tested on.
  baseUrl: string;
  // A second origin serving the same app, for cross-origin frames.
  otherUrl: string;
  url(
    page: GauntletPage | SignalPage | EvidencePage | TesterPage,
    query?: string,
  ): string;
  // "<METHOD> <path>" of every request, per origin.
  requests: { base: string[]; other: string[] };
  close(): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function file(name: string): string {
  return readFileSync(join(HERE, name), 'utf-8');
}

const FRUITS = [
  'Apple',
  'Apricot',
  'Banana',
  'Blackberry',
  'Blueberry',
  'Cherry',
  'Grape',
  'Lemon',
  'Mango',
  'Orange',
  'Peach',
  'Pear',
];

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  otherOrigin: () => string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://gauntlet');
  const path = url.pathname;

  // {{#buggy}}...{{/buggy}} and {{#clean}}...{{/clean}} keep their content in
  // that variant only, so a defect planted in the markup itself (a missing
  // attribute, a script that throws while loading) has a clean twin.
  const variant =
    url.searchParams.get('variant') === 'clean' ? 'clean' : 'buggy';
  // {{#in}}...{{/in}} and {{#out}}...{{/out}}: for a visitor signed in to
  // ev-login, or not.
  const signedIn = evSignedIn(req) ? 'in' : 'out';
  const html = (body: string) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      body
        .replace(
          /\{\{#(in|out)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
          (_, only: string, inner: string) => (only === signedIn ? inner : ''),
        )
        .replace(
          /\{\{#(buggy|clean)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
          (_, only: string, inner: string) => (only === variant ? inner : ''),
        )
        .replaceAll('{{VARIANT}}', variant)
        .replace('{{HUGE_RECORDS}}', hugeRecords)
        .replaceAll('{{OTHER_ORIGIN}}', otherOrigin()),
    );
  };

  if (path === '/_g.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(file('runtime.js'));
    return;
  }
  if (path === '/_g.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(file('style.css'));
    return;
  }

  if (await handleSignalRoute(req, res, url)) return;
  if (await handleEvidenceRoute(req, res, url)) return;

  // Async combobox options, slow on purpose.
  if (path === '/api/options') {
    await sleep(300);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(FRUITS.filter((f) => f.toLowerCase().includes(q))));
    return;
  }
  if (path === '/api/slow') {
    await sleep(1_500);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ loaded: true }));
    return;
  }
  if (path === '/api/poll') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ now: Date.now() }));
    return;
  }
  // Six chunks over three seconds.
  if (path === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    for (let i = 1; i <= 6; i++) {
      res.write(`chunk ${i}\n`);
      await sleep(500);
    }
    res.end();
    return;
  }

  // An open redirect on the app's own origin.
  if (path === '/redirect') {
    res.writeHead(302, { Location: url.searchParams.get('to') ?? '/' });
    res.end();
    return;
  }
  // A request the server drops without answering.
  if (path === '/api/dead') {
    req.socket.destroy();
    return;
  }
  if (path === '/api/report.csv') {
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="report.csv"',
    });
    res.end('id,total\n1,120\n');
    return;
  }
  // The only credentials the login page accepts.
  if (path === '/api/login' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);
    const ok =
      form.get('email') === 'ghost@example.com' &&
      form.get('password') === 'boo-1234';
    res.writeHead(
      302,
      ok
        ? {
            'Set-Cookie': 'gauntlet_session=signed-in; Path=/; HttpOnly',
            Location: '/account',
          }
        : { Location: '/login?error=1' },
    );
    res.end();
    return;
  }
  if (path === '/account') {
    const signedIn = (req.headers.cookie ?? '').includes(
      'gauntlet_session=signed-in',
    );
    html(
      `<!doctype html><title>Gauntlet — account</title><script src="/_g.js"></script><h1>${signedIn ? 'Your account' : 'Please log in'}</h1>${signedIn ? '<button data-g="sign-out" type="button">Sign out</button>' : '<a data-g="to-login" href="/login">Log in</a>'}`,
    );
    return;
  }

  // Sub-pages: /frame/form, /tabs/child, /spa/<route> ...
  const [, first, second] = path.split('/');
  if ((first === 'frame' || first === 'tabs') && second) {
    html(file(join('pages', `${first}-${second}.html`)));
    return;
  }
  if (first === 'spa') {
    html(file(join('pages', 'spa.html')));
    return;
  }
  if (
    (GAUNTLET_PAGES as readonly string[]).includes(first) ||
    (SIGNAL_PAGES as readonly string[]).includes(first) ||
    (EVIDENCE_PAGES as readonly string[]).includes(first) ||
    (TESTER_PAGES as readonly string[]).includes(first)
  ) {
    html(file(join('pages', `${first}.html`)));
    return;
  }
  if (path === '/') {
    html(
      `<title>Gauntlet</title><h1>Gauntlet</h1><ul>${[
        ...GAUNTLET_PAGES,
        ...SIGNAL_PAGES,
        ...EVIDENCE_PAGES,
        ...TESTER_PAGES,
      ]
        .map((p) => `<li><a href="/${p}">${p}</a></li>`)
        .join('')}</ul>`,
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<title>Not found</title><h1>Not found</h1>');
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  );
}

function shutdown(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

export async function startGauntlet(): Promise<Gauntlet> {
  const requests = { base: [] as string[], other: [] as string[] };
  let baseUrl = '';
  let otherUrl = '';

  const make = (log: string[]) =>
    createServer((req, res) => {
      log.push(`${req.method} ${(req.url ?? '/').split('?')[0]}`);
      handle(req, res, () => otherUrl).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });

  const base = make(requests.base);
  const other = make(requests.other);
  [baseUrl, otherUrl] = await Promise.all([listen(base), listen(other)]);

  return {
    baseUrl,
    otherUrl,
    url: (page, query) => `${baseUrl}/${page}${query ? `?${query}` : ''}`,
    requests,
    close: async () => {
      await Promise.all([shutdown(base), shutdown(other)]);
    },
  };
}
