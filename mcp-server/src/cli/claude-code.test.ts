import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  claudeArgs,
  commandFor,
  interpret,
  isClaudeCodeAvailable,
  pluginRoot,
  runViaClaudeCode,
} from './claude-code.js';
import { type CliOptions, chooseRunner } from './headless.js';

const OPTIONS: CliOptions = {
  targetUrl: 'http://localhost:3000',
  personas: ['confused-beginner', 'malicious-user'],
  steps: 3,
  headless: true,
  verbose: false,
};

describe('haunt-ci through Claude Code', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'haunt-claude-'));
  });
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  // A report as the command leaves it, and the session's printed result.
  function reportIn(dir: string, severities: string[]) {
    mkdirSync(join(dir, '.haunt-reports'), { recursive: true });
    writeFileSync(
      join(dir, '.haunt-reports', 'run.json'),
      JSON.stringify({ issues: severities.map((severity) => ({ severity })) }),
    );
    return JSON.stringify({
      is_error: false,
      result: `4 areas tested · ${severities.length} issues\n\nreport: .haunt-reports/run.md\n----`,
    });
  }

  describe('the command it runs', () => {
    it('is the slash command a user would type, never waiting for confirmation', () => {
      expect(commandFor(OPTIONS)).toBe(
        '/haunt:haunt-test http://localhost:3000 --yes --steps 3 --personas confused-beginner,malicious-user',
      );
    });

    it('passes --headed, --verbose and credentials through', () => {
      expect(
        commandFor({
          ...OPTIONS,
          headless: false,
          verbose: true,
          email: 'me@x.io',
          password: 'pw',
        }),
      ).toContain('--headed --verbose --email me@x.io --password pw');
    });

    it('loads this plugin and allows nothing but its tools', () => {
      const args = claudeArgs({ ...OPTIONS, model: 'sonnet' }, '/plugin');
      expect(args.slice(0, 2)).toEqual(['-p', commandFor(OPTIONS)]);
      expect(args).toContain('--plugin-dir');
      expect(args[args.indexOf('--plugin-dir') + 1]).toBe('/plugin');
      const allowed = args.slice(
        args.indexOf('--allowedTools') + 1,
        args.indexOf('--output-format'),
      );
      expect(allowed.every((tool) => tool.includes('haunt'))).toBe(true);
      expect(args.join(' ')).not.toMatch(/skip-permissions|bypassPermissions/);
      expect(args.slice(-2)).toEqual(['--model', 'sonnet']);
    });

    it('finds the plugin this code ships in', () => {
      expect(pluginRoot().endsWith('haunt')).toBe(true);
    });
  });

  describe('the verdict', () => {
    it.each([
      [['minor', 'suggestion'], 0],
      [[], 0],
      [['minor', 'major'], 1],
      [['critical'], 1],
    ])('issues %j exit with %i', (severities, exitCode) => {
      const dir = mkdtempSync(join(tmp, 'verdict-'));
      const run = interpret(reportIn(dir, severities), dir);
      expect(run.exitCode).toBe(exitCode);
      expect(run.reportPath).toBe('.haunt-reports/run.md');
      expect(run.output).toContain('areas tested');
    });

    it.each([
      ['not json at all', /did not return a result/],
      [
        JSON.stringify({ is_error: true, result: 'Credit balance is too low' }),
        /Credit balance/,
      ],
      [
        JSON.stringify({ result: 'login failed — check your credentials' }),
        /ended without a report/,
      ],
      [
        JSON.stringify({ result: 'report: .haunt-reports/absent.md' }),
        /could not be read/,
      ],
    ])('cannot run: %s', (stdout, message) => {
      const run = interpret(stdout, tmp);
      expect(run.exitCode).toBe(2);
      expect(run.output).toMatch(message);
    });
  });

  describe('choosing how to run', () => {
    it('uses Claude Code whenever it is installed, even with an API key set', () => {
      expect(chooseRunner({}, { MISTRAL_API_KEY: 'k' }, true)).toBe(
        'claude-code',
      );
    });

    it('falls back to an API key without Claude Code', () => {
      expect(chooseRunner({}, { ANTHROPIC_API_KEY: 'k' }, false)).toBe('api');
    });

    it('respects an explicit provider', () => {
      expect(chooseRunner({ provider: 'mistral' }, {}, true)).toBe('api');
      expect(chooseRunner({ provider: 'claude-code' }, {}, true)).toBe(
        'claude-code',
      );
    });

    it('says what to install or set when there is nothing to run with', () => {
      expect(() => chooseRunner({}, {}, false)).toThrow(/Install Claude Code/);
      expect(() =>
        chooseRunner({ provider: 'claude-code' }, {}, false),
      ).toThrow(/needs the `claude` command/);
    });

    it('looks for the claude command on the PATH', () => {
      const bin = mkdtempSync(join(tmp, 'bin-'));
      expect(isClaudeCodeAvailable({ PATH: bin })).toBe(false);
      writeFileSync(
        join(bin, process.platform === 'win32' ? 'claude.cmd' : 'claude'),
        '',
      );
      expect(
        isClaudeCodeAvailable({ PATH: `/nonexistent${delimiter}${bin}` }),
      ).toBe(true);
      expect(isClaudeCodeAvailable({})).toBe(false);
    });
  });

  // A stand-in for the claude command: records how it was called, leaves a
  // report, prints a result.
  describe.skipIf(process.platform === 'win32')('a run', () => {
    function fakeClaude(script: string): {
      env: NodeJS.ProcessEnv;
      cwd: string;
    } {
      const bin = mkdtempSync(join(tmp, 'fake-'));
      const cwd = mkdtempSync(join(tmp, 'cwd-'));
      writeFileSync(join(bin, 'claude'), `#!/bin/sh\n${script}\n`);
      chmodSync(join(bin, 'claude'), 0o755);
      return {
        env: { PATH: `${bin}${delimiter}/usr/bin${delimiter}/bin` },
        cwd,
      };
    }

    it('runs the command in the working directory and reads its report', async () => {
      const { env, cwd } = fakeClaude(
        [
          'printf "%s\\n" "$@" > args.txt',
          'mkdir -p .haunt-reports',
          'echo \'{"issues":[{"severity":"critical"}]}\' > .haunt-reports/run.json',
          // printf %s, so that the \\n inside the JSON string stays as written.
          'printf "%s" \'{"is_error":false,"result":"1 areas tested\\nreport: .haunt-reports/run.md"}\'',
        ].join('\n'),
      );

      const run = await runViaClaudeCode(OPTIONS, env, cwd);

      expect(run).toMatchObject({
        exitCode: 1,
        reportPath: '.haunt-reports/run.md',
      });
      const { readFileSync } = await import('node:fs');
      const args = readFileSync(join(cwd, 'args.txt'), 'utf-8').split('\n');
      expect(args[0]).toBe('-p');
      expect(args[1]).toBe(commandFor(OPTIONS));
    });

    it('reports a session that fails without output', async () => {
      const { env, cwd } = fakeClaude('echo "not logged in" >&2; exit 1');
      const run = await runViaClaudeCode(OPTIONS, env, cwd);
      expect(run.exitCode).toBe(2);
      expect(run.output).toContain('not logged in');
    });

    it('reports a missing claude command', async () => {
      const run = await runViaClaudeCode(
        OPTIONS,
        { PATH: '/nonexistent' },
        tmp,
      );
      expect(run.exitCode).toBe(2);
      expect(run.output).toMatch(/could not be started/);
    });
  });
});
