// haunt_scout: the routes an app's page really links to, in one call.
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hauntScout } from './scout.js';
import { SessionManager } from './session/manager.js';

const PAGE = `<!doctype html><html lang="en"><title>Shop</title>
  <nav>
    <a href="/pricing">Pricing</a>
    <a href="/pricing?plan=pro#top">Pro plan</a>
    <a href="/login">Log in</a>
    <a href="#features">Features</a>
    <a href="https://elsewhere.example/docs">Docs</a>
    <a href="mailto:hello@shop.example">Write to us</a>
    <a href="/signup">Sign up</a>
    <a href="/blog">Blog</a>
    <a href="/hidden" hidden>Hidden</a>
  </nav></html>`;

describe('hauntScout', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });

  it('returns the page itself, then where its own links lead, each once', async () => {
    const manager = new SessionManager();
    const found = await hauntScout(manager, {
      target_url: `${origin}/home?ref=ad`,
      max: 10,
    });
    // No query, no fragment, no other origin, no mail, nothing hidden.
    expect(found).toEqual({
      routes: ['/home', '/pricing', '/login', '/signup', '/blog'],
      title: 'Shop',
    });
    // And no session left open.
    expect(manager.all()).toEqual([]);
  }, 30_000);

  it('keeps to four routes unless told otherwise', async () => {
    const found = await hauntScout(new SessionManager(), {
      target_url: `${origin}/`,
    });
    expect(found.routes).toEqual(['/', '/pricing', '/login', '/signup']);
  }, 30_000);

  it('closes its browser when the target does not answer', async () => {
    const manager = new SessionManager();
    await expect(
      hauntScout(manager, { target_url: 'http://127.0.0.1:9/' }),
    ).rejects.toThrow(/is not reachable/);
    expect(manager.all()).toEqual([]);
  }, 30_000);
});
