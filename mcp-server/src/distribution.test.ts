// What users actually install is the committed dist/ bundle plus the plugin
// manifests and the command prompt — none of which the src-level tests touch.
// These check that the shipped pieces boot, agree with src, and agree with
// each other.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CASE_METHOD, TESTER_BRIEF } from './engine/brief.js';
import {
  type HauntClient,
  connectInMemory,
  wrapClient,
} from './test-support/mcp-client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVER_DIR = resolve(__dirname, '..');
const REPO_ROOT = resolve(SERVER_DIR, '..');
const DIST = join(SERVER_DIR, 'dist');

// No provider keys, a cwd with no .env for dotenv to pick one up from, and
// no `claude` command in reach: these tests must never start a real Claude
// Code session.
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (/^(ANTHROPIC|MISTRAL)_API_KEY$|^HAUNT_|^PATH$/i.test(key)) continue;
    env[key] = value;
  }
  env.PATH = '';
  return env;
}

describe('shipped bundle', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'haunt-dist-'));
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function run(script: string, args: string[]) {
    return spawnSync(process.execPath, [join(DIST, script), ...args], {
      cwd: tmp,
      env: cleanEnv(),
      encoding: 'utf-8',
      timeout: 30_000,
    });
  }

  describe('dist/server.js', () => {
    let shipped: HauntClient;
    let source: HauntClient;

    beforeAll(async () => {
      shipped = await wrapClient(
        new StdioClientTransport({
          command: process.execPath,
          args: [join(DIST, 'server.js')],
          cwd: tmp,
          env: cleanEnv(),
          stderr: 'ignore',
        }),
      );
      source = await connectInMemory();
    });

    afterAll(async () => {
      await shipped?.close();
      await source?.close();
    });

    it('boots over stdio and answers a tool call', async () => {
      const result = await shipped.call<{ browser_calls: number }>(
        'haunt_estimate_cost',
        { route_count: 1, steps_per_route: 1 },
      );
      expect(result.data.browser_calls).toBe(5);
    });

    // A stale bundle has shipped before (see e1bc023, 1518b5a). If this fails,
    // run `npm run build` and commit dist/.
    it('exposes the same tools and schemas as src', async () => {
      const [fromDist, fromSrc] = await Promise.all([
        shipped.client.listTools(),
        source.client.listTools(),
      ]);
      expect(fromDist.tools).toEqual(fromSrc.tools);
      expect(shipped.client.getServerVersion()).toEqual(
        source.client.getServerVersion(),
      );
    });

    // Was: a persona's name resolves to the repo's personas/ directory. The
    // shipped server reads none now (part 4, R-T14): a session opens
    // whatever persona an older host still passes.
    it('opens a session whatever persona it is passed, since it reads none', async () => {
      const result = await shipped.call<{ session_id: string }>('haunt_spawn', {
        persona: 'no-such-persona',
        target_url: 'data:text/html,<h1>x</h1>',
        replay_budget_ms: 0,
      });
      expect(result.isError, result.text).toBe(false);
      expect(result.text).not.toMatch(/persona/i);
      await shipped.call('haunt_end_session', {
        session_id: result.data.session_id,
      });
    });
  });

  describe('dist/cli.js (haunt-ci)', () => {
    it('prints usage and exits 2 when no URL is given', () => {
      const result = run('cli.js', []);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Usage: haunt-ci <url>');
      expect(result.stdout).toBe('');
    });

    it('exits 2 and says what to install or set when there is nothing to run with', () => {
      const result = run('cli.js', ['http://localhost:3000']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Install Claude Code');
      expect(result.stderr).toContain('ANTHROPIC_API_KEY');
    });

    it('exits 2 on an invalid flag value before doing any work', () => {
      const result = run('cli.js', ['http://localhost:3000', '--steps', '0']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('--steps must be a positive number');
    });

    it('exits 2 when the provider is forced but its key is missing', () => {
      const result = run('cli.js', [
        'http://localhost:3000',
        '--provider',
        'mistral',
      ]);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('requires MISTRAL_API_KEY');
    });
    it('exits 2 when Claude Code is asked for and is not installed', () => {
      const result = run('cli.js', [
        'http://localhost:3000',
        '--provider',
        'claude-code',
      ]);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('needs the `claude` command');
    });
  });

  describe('dist/benchmark.js (haunt-benchmark)', () => {
    it('prints usage and exits 0 on --help', () => {
      const result = run('benchmark.js', ['--help']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('haunt-benchmark');
    });

    it('exits 2 when no API key is available', () => {
      const result = run('benchmark.js', []);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('No API key found');
    });
  });
});

describe('plugin packaging', () => {
  const read = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf-8');

  it('keeps every version string in sync', () => {
    const result = spawnSync(
      process.execPath,
      [join(REPO_ROOT, 'scripts', 'check-versions.mjs')],
      { encoding: 'utf-8' },
    );
    expect(result.status, result.stderr).toBe(0);
  });

  it('points the plugin manifest at a launcher that exists', () => {
    const manifest = JSON.parse(read('.claude-plugin/plugin.json'));
    const args: string[] = manifest.mcpServers.haunt.args;
    expect(args).toEqual(['${CLAUDE_PLUGIN_ROOT}/mcp-server/start.cjs']);
    expect(existsSync(join(SERVER_DIR, 'start.cjs'))).toBe(true);
  });

  it('declares bin entries that exist in dist/', () => {
    const pkg = JSON.parse(read('mcp-server/package.json'));
    for (const target of [pkg.main, ...Object.values<string>(pkg.bin)]) {
      expect(existsSync(join(SERVER_DIR, target)), target).toBe(true);
    }
  });

  it('vendors the Playwright runtime the launcher installs Chromium for', () => {
    const browsers = JSON.parse(
      readFileSync(
        join(DIST, 'node_modules', 'playwright-core', 'browsers.json'),
        'utf-8',
      ),
    ).browsers as Array<{ name: string; revision: string }>;
    expect(browsers.find((b) => b.name === 'chromium')?.revision).toBeTruthy();
  });

  it('only references tools in /haunt-test that the server provides', async () => {
    const haunt = await connectInMemory();
    try {
      const { tools } = await haunt.client.listTools();
      const provided = new Set(tools.map((t) => t.name));
      const referenced = new Set(
        read('commands/haunt-test.md').match(/haunt_[a-z_]+/g),
      );
      expect(referenced.size).toBeGreaterThan(0);
      for (const name of referenced) {
        expect(provided, name).toContain(name);
      }
      // And the other way round: a tool the command never mentions is one the
      // orchestrator will never call.
      for (const name of provided) {
        expect(referenced, name).toContain(name);
      }
    } finally {
      await haunt.close();
    }
  });

  // Was: the docs name only personas that ship. None ships any more (part 4,
  // R-T14), so none may be named as something to run.
  it('documents no persona, now that none ships', () => {
    expect(existsSync(join(REPO_ROOT, 'personas'))).toBe(false);
    for (const path of ['README.md', 'docs/cli.md', 'commands/haunt-test.md']) {
      expect(read(path), path).not.toMatch(
        /--personas|confused-beginner|malicious-user|screen-reader-user/,
      );
    }
  });

  // The agents are what Claude Code runs; the briefs are what haunt-ci
  // sends. One method, written once (engine/brief.ts).
  it('ships a tester that holds its brief and the way to write cases, word for word', () => {
    expect(read('agents/haunt-tester.md')).toContain(TESTER_BRIEF);
    expect(read('agents/haunt-tester.md')).toContain(CASE_METHOD);
  });
});
