#!/usr/bin/env node
// mcp-server/src/cli/headless.ts
//
// Standalone, non-interactive entrypoint: everything commands/haunt-test.md does
// through an interactive Claude Code session, but callable from a shell/CI pipeline
// with no orchestrating agent. Persona action decisions come from a direct LLM API
// call per step instead of the host LLM — this is the piece the README's
// "add personas, run it in CI" line needed and didn't have (see the audit's Majeur
// on this). Supports Anthropic and Mistral as interchangeable reasoning providers
// (see src/cli/providers/) — pick whichever key you have.
//
// Scope for this first version: tests exactly the one URL given, across the given
// personas, in parallel. It does not do the interactive command's Phase 1 route
// discovery (scouting up to 4 areas from real links) — that's a reasonable next
// step, not implemented here to keep this landing as a working, honestly-scoped v1.
import 'dotenv/config';
import { isMainModule } from '../is-main-module.js';
import Anthropic from '@anthropic-ai/sdk';
import { Mistral } from '@mistralai/mistralai';
import { SessionManager } from '../session/manager.js';
import { hauntCaptureState } from '../tools/capture.js';
import { hauntEndSession } from '../tools/end-session.js';
import type {
  GenerateReportOutput,
  SessionResult,
} from '../tools/generate-report.js';
import { hauntGenerateReport } from '../tools/generate-report.js';
import { hauntNavigate } from '../tools/navigate.js';
import { hauntSpawn } from '../tools/spawn.js';
import { createAnthropicDecider } from './providers/anthropic.js';
import { createMistralDecider } from './providers/mistral.js';
import type { ActionDecider } from './providers/types.js';

export type Provider = 'anthropic' | 'mistral';

export interface CliOptions {
  targetUrl: string;
  personas: string[];
  steps: number;
  provider?: Provider;
  model?: string;
  headless: boolean;
}

const USAGE =
  'Usage: haunt-ci <url> [--personas p1,p2] [--steps N] [--provider anthropic|mistral] [--model id] [--headed]';

const VALUED_FLAGS = ['personas', 'steps', 'provider', 'model'];

export function parseArgs(argv: string[]): CliOptions {
  const getFlag = (name: string): string | undefined => {
    const idx = argv.indexOf(`--${name}`);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };

  // The positional URL is whatever isn't a `--flag` and isn't the value
  // immediately following one of the flags that takes one.
  const consumedValueIndices = new Set(
    VALUED_FLAGS.map((name) => argv.indexOf(`--${name}`))
      .filter((idx) => idx !== -1)
      .map((idx) => idx + 1),
  );
  const targetUrl = argv.find(
    (a, i) => !a.startsWith('--') && !consumedValueIndices.has(i),
  );
  if (!targetUrl) {
    throw new Error(USAGE);
  }

  const personas = (getFlag('personas') ?? 'confused-beginner')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const steps = Number(getFlag('steps') ?? '3');
  if (!Number.isFinite(steps) || steps < 1) {
    throw new Error(
      `--steps must be a positive number, got: ${getFlag('steps')}`,
    );
  }

  const providerFlag = getFlag('provider');
  if (
    providerFlag &&
    providerFlag !== 'anthropic' &&
    providerFlag !== 'mistral'
  ) {
    throw new Error(
      `--provider must be "anthropic" or "mistral", got: ${providerFlag}`,
    );
  }

  const headless = !argv.includes('--headed');

  return {
    targetUrl,
    personas,
    steps,
    provider: providerFlag as Provider | undefined,
    model: getFlag('model'),
    headless,
  };
}

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-opus-5',
  mistral: 'mistral-small-latest',
};

export interface ResolvedProvider {
  provider: Provider;
  model: string;
}

// Separate from parseArgs so argument parsing stays a pure function — this is the
// one place that reads the environment, and it's where a missing/mismatched API
// key turns into a clear error instead of an opaque SDK auth failure downstream.
export function resolveProvider(
  options: Pick<CliOptions, 'provider' | 'model'>,
  env: NodeJS.ProcessEnv,
): ResolvedProvider {
  let provider = options.provider;
  if (!provider) {
    if (env.ANTHROPIC_API_KEY) provider = 'anthropic';
    else if (env.MISTRAL_API_KEY) provider = 'mistral';
    else {
      throw new Error(
        'No API key found. Set ANTHROPIC_API_KEY or MISTRAL_API_KEY in the environment (a .env file is loaded automatically), or pass --provider explicitly.',
      );
    }
  }

  const apiKeyVar =
    provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'MISTRAL_API_KEY';
  if (!env[apiKeyVar]) {
    throw new Error(`--provider ${provider} requires ${apiKeyVar} to be set.`);
  }

  const model = options.model ?? env.HAUNT_CI_MODEL ?? DEFAULT_MODEL[provider];
  return { provider, model };
}

export function createDecider(resolved: ResolvedProvider): ActionDecider {
  if (resolved.provider === 'anthropic') {
    return createAnthropicDecider(new Anthropic(), resolved.model);
  }
  return createMistralDecider(
    new Mistral({ apiKey: process.env.MISTRAL_API_KEY }),
    resolved.model,
  );
}

function describeState(
  url: string,
  title: string,
  accessibilityTree: string | undefined,
  accessibilityTreeError: string | undefined,
  step: number,
  steps: number,
): string {
  const treeSection = accessibilityTree
    ? accessibilityTree
    : `(unavailable: ${accessibilityTreeError ?? 'unknown error'})`;
  return `URL: ${url}\nTitle: ${title}\nStep ${step} of ${steps}\n\nAccessibility tree:\n${treeSection}`;
}

async function runPersonaSession(
  decide: ActionDecider,
  manager: SessionManager,
  personaName: string,
  targetUrl: string,
  steps: number,
  headless: boolean,
): Promise<SessionResult> {
  const spawnResult = await hauntSpawn(manager, {
    persona: personaName,
    target_url: targetUrl,
    headless,
    timeout: steps,
  });

  for (let step = 1; step <= steps; step++) {
    const state = await hauntCaptureState(manager, {
      session_id: spawnResult.session_id,
      include_screenshot: false,
      include_dom: false,
    });

    const stateDescription = describeState(
      state.url,
      state.title,
      state.accessibility_tree,
      state.accessibility_tree_error,
      step,
      steps,
    );

    const { action, issues } = await decide(
      spawnResult.persona_description,
      stateDescription,
    );

    await hauntNavigate(manager, {
      session_id: spawnResult.session_id,
      action,
      issues,
    });
  }

  const endResult = await hauntEndSession(manager, {
    session_id: spawnResult.session_id,
  });

  return {
    area: targetUrl,
    persona: spawnResult.persona_name,
    overall_impression: endResult.overall_impression,
    issues: endResult.issues_found,
  };
}

export interface HeadlessRunResult {
  report: GenerateReportOutput;
  failures: string[];
}

export async function runHeadlessTest(
  decide: ActionDecider,
  manager: SessionManager,
  options: Pick<CliOptions, 'targetUrl' | 'personas' | 'steps' | 'headless'>,
): Promise<HeadlessRunResult> {
  const settled = await Promise.allSettled(
    options.personas.map((persona) =>
      runPersonaSession(
        decide,
        manager,
        persona,
        options.targetUrl,
        options.steps,
        options.headless,
      ),
    ),
  );

  const sessions: SessionResult[] = [];
  const failures: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sessions.push(result.value);
    } else {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      failures.push(`${options.personas[i]}: ${message}`);
    }
  });

  if (sessions.length === 0) {
    throw new Error(`All persona sessions failed: ${failures.join('; ')}`);
  }

  const report = hauntGenerateReport({
    target_url: options.targetUrl,
    personas: options.personas,
    sessions,
  });

  return { report, failures };
}

async function main() {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  let resolved: ResolvedProvider;
  try {
    resolved = resolveProvider(options, process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  console.error(
    `[haunt-ci] provider: ${resolved.provider}, model: ${resolved.model}`,
  );

  const decide = createDecider(resolved);
  const manager = new SessionManager();

  try {
    const { report, failures } = await runHeadlessTest(
      decide,
      manager,
      options,
    );
    for (const failure of failures) {
      console.error(`skipped ${failure}`);
    }
    console.log(report.summary);

    const blocking = report.counts.critical > 0 || report.counts.major > 0;
    process.exit(blocking ? 1 : 0);
  } catch (error) {
    console.error(
      'haunt-ci failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(2);
  }
}

// Only auto-run when executed directly (not when imported by tests) — see
// is-main-module.ts for why this can't be a raw string comparison.
if (isMainModule(import.meta.url)) {
  main();
}
