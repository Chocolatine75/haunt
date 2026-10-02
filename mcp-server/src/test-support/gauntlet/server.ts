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

const HERE = fileURLToPath(new URL('.', import.meta.url));

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
] as const;

export type GauntletPage = (typeof GAUNTLET_PAGES)[number];

export interface Gauntlet {
  // Origin the pages are tested on.
  baseUrl: string;
  // A second origin serving the same app, for cross-origin frames.
  otherUrl: string;
  url(page: GauntletPage, query?: string): string;
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

  const html = (body: string) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body.replaceAll('{{OTHER_ORIGIN}}', otherOrigin()));
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
  if ((GAUNTLET_PAGES as readonly string[]).includes(first)) {
    html(file(join('pages', `${first}.html`)));
    return;
  }
  if (path === '/') {
    html(
      `<title>Gauntlet</title><h1>Gauntlet</h1><ul>${GAUNTLET_PAGES.map(
        (p) => `<li><a href="/${p}">${p}</a></li>`,
      ).join('')}</ul>`,
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
