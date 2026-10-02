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
import Anthropic from '@anthropic-ai/sdk';
import { Mistral } from '@mistralai/mistralai';
import type { Cookie } from 'playwright';
import { hauntAct } from '../engine/act/act.js';
import { hauntCaptureState } from '../engine/capture.js';
import { hauntEndSession } from '../engine/end-session.js';
import type {
  GenerateReportOutput,
  SessionResult,
} from '../engine/report/generate-report.js';
import { hauntGenerateReport } from '../engine/report/generate-report.js';
import { SessionManager } from '../engine/session/manager.js';
import { hauntSpawn } from '../engine/spawn.js';
import type { ActResult } from '../gates/part-1/contract.js';
import { authenticate } from './authenticate.js';
import { createAnthropicDecider } from './providers/anthropic.js';
import { createMistralDecider } from './providers/mistral.js';
import { type ActionDecider, MAX_ACTIONS_PER_STEP } from './providers/types.js';

export type Provider = 'anthropic' | 'mistral';

export interface CliOptions {
  targetUrl: string;
  personas: string[];
  steps: number;
  provider?: Provider;
  model?: string;
  headless: boolean;
  email?: string;
  password?: string;
  loginUrl?: string;
}

const USAGE =
  'Usage: haunt-ci <url> [--personas p1,p2] [--steps N] [--provider anthropic|mistral] [--model id] [--headed] [--email addr --password pw] [--login-url url]';

const VALUED_FLAGS = [
  'personas',
  'steps',
  'provider',
  'model',
  'email',
  'password',
  'login-url',
];

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

  const email = getFlag('email');
  const password = getFlag('password');
  if ((email && !password) || (password && !email)) {
    throw new Error('--email and --password must be given together.');
  }

  return {
    targetUrl,
    personas,
    steps,
    provider: providerFlag as Provider | undefined,
    model: getFlag('model'),
    headless,
    email,
    password,
    loginUrl: getFlag('login-url'),
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

const UNAUTHENTICATED_NOTE =
  'Note: you are NOT logged in for this session. If this page shows content ' +
  'that looks private, personalized, or administrative (e.g. a dashboard, ' +
  'account data, admin controls) without redirecting you to a login page ' +
  'first, that is itself a serious security bug — report it.';

// The decider only ever sees the next step's state description, so whatever
// its last actions did has to be told there. Without the sandbox note a
// blocked request reaches it as an unexplained broken-looking page, and it
// files an app bug.
const SANDBOX_BLOCK_NOTE =
  'Note: your last action was blocked by the haunt test sandbox because it ' +
  'targeted an origin outside the app under test. This is NOT an app bug — ' +
  'do not report it as an issue. Blocked: ';

const HOW_TO_ACT =
  'Elements are named by the reference in square brackets, e.g. [e12]. Use ' +
  'that reference in your actions. A failed action is information about the ' +
  'page (covered, disabled, gone), not necessarily a bug. An action that ' +
  'changed nothing at all on a control that should do something is worth ' +
  'reporting.';

// What the last decision did, in a few lines the next decision can use.
function describeOutcome(result: ActResult): string {
  const lines = result.results.map((step, i) => {
    if (!step.ok)
      return `${i + 1}. ${step.type}: FAILED — ${step.error?.message}`;
    const effects: string[] = [];
    if (step.changes.navigated)
      effects.push(`went to ${step.changes.url_after}`);
    if (step.changes.tabs_opened.length > 0) effects.push('opened a new tab');
    if (step.changes.dialog) {
      effects.push(
        `a ${step.changes.dialog.type} dialog opened: "${step.changes.dialog.message}"`,
      );
    }
    if (step.changes.download)
      effects.push(`downloaded ${step.changes.download.filename}`);
    if (step.changes.none) effects.push('nothing changed on the page');
    else if (effects.length === 0) effects.push('the page changed');
    if (!step.settled)
      effects.push('the page was still busy when the wait ran out');
    return `${i + 1}. ${step.type}: ${effects.join(', ')}`;
  });
  if (result.requested > result.executed) {
    lines.push(
      `(${result.requested - result.executed} further action(s) were not run)`,
    );
  }
  if (result.console_errors.length > 0) {
    lines.push(
      `Console errors: ${result.console_errors.slice(0, 5).join(' | ')}`,
    );
  }
  if (result.network_errors.length > 0) {
    lines.push(
      `Failed requests: ${result.network_errors.slice(0, 5).join(' | ')}`,
    );
  }
  return `Your last actions:\n${lines.join('\n')}`;
}

function describeState(
  snapshot: string,
  step: number,
  steps: number,
  authenticated: boolean,
  last?: ActResult,
): string {
  const sections = [`Step ${step} of ${steps}\n\n${snapshot}`, HOW_TO_ACT];
  if (last) sections.push(describeOutcome(last));
  if (!authenticated) sections.push(UNAUTHENTICATED_NOTE);
  if (last?.sandbox_blocked?.length) {
    sections.push(`${SANDBOX_BLOCK_NOTE}${last.sandbox_blocked.join('; ')}`);
  }
  return sections.join('\n\n');
}

async function runPersonaSession(
  decide: ActionDecider,
  manager: SessionManager,
  personaName: string,
  targetUrl: string,
  steps: number,
  headless: boolean,
  cookies?: Cookie[],
): Promise<SessionResult> {
  const authenticated = Boolean(cookies && cookies.length > 0);
  const spawnResult = await hauntSpawn(manager, {
    persona: personaName,
    target_url: targetUrl,
    headless,
    // One step is one decision, which may carry several actions.
    timeout: steps * MAX_ACTIONS_PER_STEP,
    cookies,
  });

  try {
    let last: ActResult | undefined;
    for (let step = 1; step <= steps; step++) {
      const state = await hauntCaptureState(manager, {
        session_id: spawnResult.session_id,
        format: 'text',
      });

      const { actions, issues } = await decide(
        spawnResult.persona_description,
        describeState(state.text, step, steps, authenticated, last),
      );

      last = await hauntAct(manager, {
        session_id: spawnResult.session_id,
        actions,
        issues,
      });
    }
  } catch (error) {
    // The browser must not outlive a session that failed half-way.
    if (manager.has(spawnResult.session_id)) {
      await hauntEndSession(manager, {
        session_id: spawnResult.session_id,
      }).catch(() => {});
    }
    throw error;
  }

  const endResult = await hauntEndSession(manager, {
    session_id: spawnResult.session_id,
  });

  return {
    area: targetUrl,
    persona: spawnResult.persona_name,
    overall_impression: endResult.overall_impression,
    issues: endResult.issues_found,
    sandbox_blocked_requests: endResult.sandbox_blocked_requests,
  };
}

export interface HeadlessRunResult {
  report: GenerateReportOutput;
  failures: string[];
}

export async function runHeadlessTest(
  decide: ActionDecider,
  manager: SessionManager,
  options: Pick<CliOptions, 'targetUrl' | 'personas' | 'steps' | 'headless'> & {
    cookies?: Cookie[];
  },
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
        options.cookies,
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

// Invoked by bin.ts — the only module that calls it, so importing this file
// (from tests, or from benchmark/run.ts) never starts a run.
export async function main() {
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

  let cookies: Cookie[] | undefined;
  if (options.email && options.password) {
    const loginUrl =
      options.loginUrl ?? new URL('/login', options.targetUrl).toString();
    console.error(`[haunt-ci] authenticating at ${loginUrl}...`);
    try {
      cookies = await authenticate(manager, {
        loginUrl,
        email: options.email,
        password: options.password,
        headless: options.headless,
      });
      console.error(`[haunt-ci] authenticated — ${cookies.length} cookie(s)`);
    } catch (error) {
      console.error(
        'haunt-ci failed: login failed —',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  }

  try {
    const { report, failures } = await runHeadlessTest(decide, manager, {
      ...options,
      cookies,
    });
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
