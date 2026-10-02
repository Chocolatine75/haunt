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
import {
  type HauntClient,
  connectInMemory,
  wrapClient,
} from './test-support/mcp-client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVER_DIR = resolve(__dirname, '..');
const REPO_ROOT = resolve(SERVER_DIR, '..');
const DIST = join(SERVER_DIR, 'dist');

// No provider keys, and a cwd with no .env for dotenv to pick one up from.
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (/^(ANTHROPIC|MISTRAL)_API_KEY$|^HAUNT_/.test(key)) continue;
    env[key] = value;
  }
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

    it('resolves built-in persona names to the repo personas/ directory', async () => {
      const result = await shipped.call('haunt_spawn', {
        persona: 'no-such-persona',
        target_url: 'data:text/html,<h1>x</h1>',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toContain(
        join(REPO_ROOT, 'personas', 'no-such-persona.yaml'),
      );
    });
  });

  describe('dist/cli.js (haunt-ci)', () => {
    it('prints usage and exits 2 when no URL is given', () => {
      const result = run('cli.js', []);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Usage: haunt-ci <url>');
      expect(result.stdout).toBe('');
    });

    it('exits 2 with a clear message when no API key is available', () => {
      const result = run('cli.js', ['http://localhost:3000']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('No API key found');
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

  it('documents only personas that ship', () => {
    const documented = new Set(
      `${read('README.md')}${read('docs/cli.md')}${read('commands/haunt-test.md')}`.match(
        /\b(confused-beginner|malicious-user|screen-reader-user)\b/g,
      ),
    );
    expect(documented.size).toBe(3);
    for (const name of documented) {
      expect(
        existsSync(join(REPO_ROOT, 'personas', `${name}.yaml`)),
        name,
      ).toBe(true);
    }
  });
});
