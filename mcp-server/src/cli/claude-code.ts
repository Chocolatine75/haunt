// mcp-server/src/cli/claude-code.ts
//
// haunt-ci's default way of running: hand the real /haunt-test command to a
// headless Claude Code session (`claude -p`). The session uses the Claude
// Code account already set up on the machine, so no API key is needed, and
// it runs the same prompt as the interactive command — route discovery,
// login, the persona's judgement — instead of a second, smaller loop.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliOptions } from './headless.js';

// The MCP tools of the plugin, as Claude Code names them. Nothing else is
// allowed: the session can drive haunt's browser and that is all.
const ALLOWED_TOOLS = ['mcp__plugin_haunt_haunt', 'mcp__haunt'];
const RUN_TIMEOUT_MS = 20 * 60 * 1_000;

export interface ClaudeCodeRun {
  // What haunt-ci exits with: 0 clean, 1 blocking issues, 2 could not run.
  exitCode: 0 | 1 | 2;
  // What to print: the command's own summary, or why it could not run.
  output: string;
  reportPath?: string;
}

export function isClaudeCodeAvailable(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const names =
    process.platform === 'win32'
      ? ['claude.cmd', 'claude.exe', 'claude']
      : ['claude'];
  return (env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => names.some((name) => existsSync(join(dir, name))));
}

// The plugin this binary ships in: dist/cli.js → mcp-server/ → the plugin.
export function pluginRoot(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  for (const candidate of [resolve(here, '../..'), resolve(here, '../../..')]) {
    if (existsSync(join(candidate, '.claude-plugin', 'plugin.json'))) {
      return candidate;
    }
  }
  return resolve(here, '../..');
}

// The slash command as a user would type it.
export function commandFor(options: CliOptions): string {
  const parts = [
    `/haunt:haunt-test ${options.targetUrl}`,
    '--yes',
    `--steps ${options.steps}`,
    `--personas ${options.personas.join(',')}`,
  ];
  if (!options.headless) parts.push('--headed');
  if (options.verbose) parts.push('--verbose');
  if (options.email && options.password) {
    parts.push(`--email ${options.email}`, `--password ${options.password}`);
  }
  return parts.join(' ');
}

export function claudeArgs(options: CliOptions, plugin: string): string[] {
  const args = [
    '-p',
    commandFor(options),
    '--plugin-dir',
    plugin,
    '--allowedTools',
    ...ALLOWED_TOOLS,
    '--output-format',
    'json',
  ];
  if (options.model) args.push('--model', options.model);
  return args;
}

interface ClaudeResult {
  is_error?: boolean;
  result?: string;
}

// Turns what the session printed into haunt-ci's verdict. The command ends
// with "report: <path>"; the counts come from that report's JSON sidecar,
// not from the model's wording.
export function interpret(stdout: string, cwd: string): ClaudeCodeRun {
  let parsed: ClaudeResult;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      exitCode: 2,
      output: `Claude Code did not return a result:\n${stdout.slice(0, 2_000)}`,
    };
  }
  const text = parsed.result ?? '';
  if (parsed.is_error)
    return { exitCode: 2, output: text || 'Claude Code reported an error.' };

  const reportPath = text.match(/^report:\s*(\S+\.md)\s*$/m)?.[1];
  if (!reportPath) {
    return {
      exitCode: 2,
      output: `The run ended without a report.\n${text}`,
    };
  }
  const sidecar = resolve(cwd, reportPath.replace(/\.md$/, '.json'));
  let issues: Array<{ severity?: string }>;
  try {
    issues = JSON.parse(readFileSync(sidecar, 'utf-8')).issues;
  } catch {
    return {
      exitCode: 2,
      output: `The report's data could not be read at ${sidecar}.\n${text}`,
      reportPath,
    };
  }
  const blocking = issues.some(
    (issue) => issue.severity === 'critical' || issue.severity === 'major',
  );
  return { exitCode: blocking ? 1 : 0, output: text, reportPath };
}

export function runViaClaudeCode(
  options: CliOptions,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): Promise<ClaudeCodeRun> {
  return new Promise((done) => {
    const child = spawn('claude', claudeArgs(options, pluginRoot()), {
      cwd,
      env,
      // No stdin: the CLI would otherwise wait for it.
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill(), RUN_TIMEOUT_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      done({
        exitCode: 2,
        output: `Claude Code could not be started: ${error.message}`,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        done({
          exitCode: 2,
          output: `Claude Code exited with code ${code}.\n${stderr.slice(0, 2_000)}`,
        });
        return;
      }
      done(interpret(stdout, cwd));
    });
  });
}
