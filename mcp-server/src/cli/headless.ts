// mcp-server/src/cli/headless.ts
//
// Standalone, non-interactive entrypoint: what commands/haunt-test.md does
// through a Claude Code session, callable from a shell or a CI pipeline with
// no orchestrating agent. The decisions come from a direct LLM API call per
// step: one for the plan, under the planner's brief, then one per step under
// the tester's (engine/brief.ts). Anthropic and Mistral are interchangeable
// (src/cli/providers/).
//
// It tests the one URL given. It does not do the command's route discovery.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Mistral } from '@mistralai/mistralai';
import type { Cookie } from 'playwright';
import { hauntAct } from '../engine/act/act.js';
import { briefFor } from '../engine/brief.js';
import { hauntCaptureState } from '../engine/capture.js';
import { hauntEndSession } from '../engine/end-session.js';
import { malformed } from '../engine/plan/expect.js';
import { hauntPlan } from '../engine/plan/plan.js';
import type {
  GenerateReportOutput,
  SessionResult,
} from '../engine/report/generate-report.js';
import { hauntGenerateReport } from '../engine/report/generate-report.js';
import { SessionManager } from '../engine/session/manager.js';
import { DEFAULT_BUDGET, hauntSpawn } from '../engine/spawn.js';
import type { Issue } from '../engine/types.js';
import type { ActResult } from '../gates/part-1/contract.js';
import type { Signal } from '../gates/part-2/contract.js';
import type {
  ActTesterResult,
  CaseStatus,
  InventoryControl,
} from '../gates/part-4/contract.js';
import { authenticate } from './authenticate.js';
import { isClaudeCodeAvailable, runViaClaudeCode } from './claude-code.js';
import { createAnthropicDecider } from './providers/anthropic.js';
import { createMistralDecider } from './providers/mistral.js';
import {
  type ActionDecider,
  type ActionDecision,
  MAX_ACTIONS_PER_STEP,
} from './providers/types.js';

export type Provider = 'anthropic' | 'mistral';

export interface CliOptions {
  targetUrl: string;
  // Ignored: personas are gone (part 4). Still accepted from a caller, and
  // on the command line, written before.
  personas?: string[];
  // A file describing what the app is meant to do, given to the planner and
  // the testers as it is (R-T15).
  specPath?: string;
  // Lets attack payloads be planned. Only against an app you own.
  hostile?: boolean;
  steps: number;
  // 'claude-code' runs the real command in a headless Claude Code session,
  // on the account set up on this machine; the others call an API with a key.
  provider?: Provider | 'claude-code';
  model?: string;
  headless: boolean;
  // Print each decision and what it did, to stderr.
  verbose?: boolean;
  email?: string;
  password?: string;
  loginUrl?: string;
}

const USAGE =
  'Usage: haunt-ci <url> [--spec file] [--hostile] [--steps N] [--provider claude-code|anthropic|mistral] [--model id] [--headed] [--verbose] [--email addr --password pw] [--login-url url]';

const VALUED_FLAGS = [
  // No longer used; still takes its value, so that it is not read as the URL.
  'personas',
  'spec',
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

  const steps = Number(getFlag('steps') ?? String(DEFAULT_BUDGET));
  if (!Number.isFinite(steps) || steps < 1) {
    throw new Error(
      `--steps must be a positive number, got: ${getFlag('steps')}`,
    );
  }

  const providerFlag = getFlag('provider');
  if (
    providerFlag &&
    providerFlag !== 'claude-code' &&
    providerFlag !== 'anthropic' &&
    providerFlag !== 'mistral'
  ) {
    throw new Error(
      `--provider must be "claude-code", "anthropic" or "mistral", got: ${providerFlag}`,
    );
  }

  const headless = !argv.includes('--headed');
  const verbose = argv.includes('--verbose');

  const email = getFlag('email');
  const password = getFlag('password');
  if ((email && !password) || (password && !email)) {
    throw new Error('--email and --password must be given together.');
  }

  return {
    targetUrl,
    specPath: getFlag('spec'),
    hostile: argv.includes('--hostile'),
    steps,
    provider: providerFlag as CliOptions['provider'],
    model: getFlag('model'),
    headless,
    verbose,
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
  options: { provider?: Provider; model?: string },
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
  'that reference in your actions; every action is an object with a "type". ' +
  'A failed action is information about the page (covered, disabled, gone), ' +
  'not necessarily a bug.\n' +
  'Report an issue as soon as you have seen it — in this very answer, not ' +
  'later. In particular, look at what your last actions did: a button or a ' +
  'submit that changed nothing on the page, a server error in the console ' +
  '(status 500, an exception), a form accepted or refused without any ' +
  'message, private content shown without logging in. Each of those is an ' +
  'issue a real user would hit.\n' +
  'Every issue must be checkable: name the signal it is about in "signal", ' +
  'or state what the page shows in "observed" (text_present, text_absent, ' +
  "url, or an element's state, after a step). Each is replayed in a fresh " +
  'browser before it is reported; one with neither is rejected.';

// Asked once after the last step, so that what the last action revealed is
// not lost: nothing would otherwise look at its result.
const WRAP_UP =
  'The session is over: no further action will be run, so leave "actions" ' +
  'empty. Report in "issues" anything you have seen and not reported yet, ' +
  'including what your last actions just revealed.';

// Signals in a few lines: the engine's own findings, which the decider
// should turn into issues rather than have to notice.
function describeSignals(title: string, signals: Signal[]): string[] {
  if (signals.length === 0) return [];
  return [
    `${title} (found by the engine; report each as an issue naming its id in "signal"):`,
    ...signals
      .slice(0, 10)
      .map(
        (s) =>
          `- ${s.id} [${s.severity}] ${s.message}${s.late ? ' (caused by an earlier step)' : ''}`,
      ),
  ];
}

// What the last decision did, in a few lines the next decision can use.
function describeOutcome(result: ActTesterResult): string {
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
  if (result.text_changes.added.length > 0) {
    lines.push(
      `Text that appeared: ${result.text_changes.added
        .slice(0, 8)
        .map((t) => JSON.stringify(t))
        .join(', ')}`,
    );
  }
  if (result.text_changes.removed.length > 0) {
    lines.push(
      `Text that went away: ${result.text_changes.removed
        .slice(0, 8)
        .map((t) => JSON.stringify(t))
        .join(', ')}`,
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
  lines.push(...describeSignals('What went wrong', result.signals));
  if (result.expectation) {
    lines.push(
      result.expectation.held
        ? 'What you expected held.'
        : `What you expected did NOT hold. The page showed: ${JSON.stringify(result.expectation.read ?? 'something else')}. If your test was right, file an issue with "case".`,
    );
  }
  if (result.new_controls?.length) {
    lines.push(
      `Controls that became usable: ${result.new_controls.map((c) => `[${c.ref}] ${c.role} "${c.name}"`).join(', ')}`,
    );
  }
  if (result.repeating) {
    lines.push(
      `That action has left the page unchanged ${result.repeating.times} times: move on.`,
    );
  }
  if (result.remaining) {
    lines.push(
      `Not exercised yet: ${result.remaining.controls.map((c) => `[${c.ref}] ${c.role} "${c.name}"`).join(', ') || 'nothing'}`,
    );
  }
  return `Your last actions:\n${lines.join('\n')}`;
}

function describeState(
  snapshot: string,
  step: number,
  steps: number,
  authenticated: boolean,
  last?: ActTesterResult,
  atLoad: Signal[] = [],
): string {
  const sections = [`Step ${step} of ${steps}\n\n${snapshot}`, HOW_TO_ACT];
  if (last) sections.push(describeOutcome(last));
  const loaded = describeSignals(
    'What went wrong while the page loaded',
    atLoad,
  );
  if (loaded.length > 0) sections.push(loaded.join('\n'));
  if (!authenticated) sections.push(UNAUTHENTICATED_NOTE);
  if (last?.sandbox_blocked?.length) {
    sections.push(`${SANDBOX_BLOCK_NOTE}${last.sandbox_blocked.join('; ')}`);
  }
  return sections.join('\n\n');
}

// What a model without tools is told on top of a brief written for one
// with them: the page is in front of it, and its answer is the decision.
const PLANNER_ANSWER =
  'You have no tools in this run. The page and its inventory are below. ' +
  'Answer with your test cases in "cases": an id, a kind, the controls by ' +
  'their reference from the inventory, and what is expected. Leave ' +
  '"actions" empty: the cases are registered for you and played next.';

const TESTER_ANSWER =
  'You have no tools in this run. Each answer is one step: the actions to ' +
  'run now in "actions", with "case" and "expect" when they play a case, ' +
  'and in "issues" what you have found. The page is read for you before ' +
  'each step, the cases are registered already, and the session is ended ' +
  'for you.';

// The inventory in a few lines a planner can plan from.
function describeInventory(inventory: InventoryControl[]): string {
  if (inventory.length === 0) return 'Inventory: the page offers no control.';
  return [
    'Inventory (every control the page offers, by group):',
    ...inventory.map(
      (c) =>
        `- [${c.ref}] ${c.role} "${c.name}" — ${c.group}${c.state ? ` (${c.state})` : ''}`,
    ),
  ].join('\n');
}

// The cases still to play, the next one first, as a tester needs them.
function describeCases(cases: CaseStatus[]): string | undefined {
  const left = cases.filter((one) => !one.verdict);
  if (cases.length === 0) return undefined;
  if (left.length === 0) {
    return 'Every case of the plan has been played. Use what is left of the session on the controls no case has exercised.';
  }
  const [next, ...later] = left;
  return [
    `Case to play now: "${next.id}" (${next.kind}), on ${next.controls.join(', ') || 'no control'}.`,
    `Expected: ${next.expect}`,
    'State that as "expect", with "case", in the answer whose actions complete it.',
    ...(later.length > 0
      ? [`Then: ${later.map((one) => `"${one.id}"`).join(', ')}.`]
      : []),
  ].join('\n');
}

interface SessionOptions {
  // How many decisions are asked for, and how many actions they may run in
  // all.
  steps: number;
  budget?: number;
  headless: boolean;
  cookies?: Cookie[];
  spec?: { name: string; text: string };
  hostile?: boolean;
}

// One session on one area: a plan is asked for, then its cases are played
// (R-T23).
async function runSession(
  decide: ActionDecider,
  manager: SessionManager,
  targetUrl: string,
  options: SessionOptions,
  log: (line: string) => void = () => {},
): Promise<SessionResult> {
  const { steps, cookies } = options;
  const authenticated = Boolean(cookies && cookies.length > 0);
  const planner = `${briefFor('planner', options.spec?.text)}\n\n${PLANNER_ANSWER}`;
  const tester = `${briefFor('tester', options.spec?.text)}\n\n${TESTER_ANSWER}`;
  const spawnResult = await hauntSpawn(manager, {
    target_url: targetUrl,
    headless: options.headless,
    // The budget of actions (R-T5). A decision carries up to five; a
    // caller that counts in decisions gets room for five in each.
    budget: options.budget ?? steps * MAX_ACTIONS_PER_STEP,
    cookies,
    hostile: options.hostile,
  });
  const session_id = spawnResult.session_id;
  const read = async () =>
    (await hauntCaptureState(manager, { session_id, format: 'text' })).text;

  let finalIssues: Issue[] = [];
  try {
    // The plan first, in a call of its own.
    const plan = await hauntPlan(manager, { session_id });
    const asked = await decide(
      planner,
      `${describeState(await read(), 1, steps, authenticated, undefined, spawnResult.signals)}\n\n${describeInventory(plan.inventory)}`,
    );
    let cases: CaseStatus[] = [];
    if (asked.cases?.length) {
      try {
        cases = (await hauntPlan(manager, { session_id, cases: asked.cases }))
          .cases;
      } catch (error) {
        // A plan the engine refuses is no plan: the session explores.
        log(
          `[plan] refused: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    log(`[plan] ${cases.length} case(s)`);
    // An answer that plans nothing and acts is a decider that does not
    // plan: its actions are the first step, as before part 4.
    let carried: ActionDecision | undefined =
      cases.length === 0 && asked.actions.length > 0 ? asked : undefined;
    if (cases.length === 0 && asked.issues.length > 0 && !carried) {
      manager.get(session_id).issues.push(...asked.issues);
    }

    let last: ActTesterResult | undefined;
    for (let step = 1; step <= steps; step++) {
      let decision = carried;
      carried = undefined;
      if (!decision) {
        const state = describeState(
          await read(),
          step,
          steps,
          authenticated,
          last,
        );
        const toPlay = describeCases(
          (await hauntPlan(manager, { session_id })).cases,
        );
        decision = await decide(
          tester,
          toPlay ? `${state}\n\n${toPlay}` : state,
        );
      }
      const { actions, issues } = decision;

      log(
        `step ${step}: ${JSON.stringify(actions)}${issues.length > 0 ? ` (+${issues.length} issue(s))` : ''}`,
      );
      if (actions.length === 0) {
        // Nothing it wants to do. Its issues still count.
        manager.get(session_id).issues.push(...issues);
        last = undefined;
        continue;
      }
      // What a model sends is checked here as the tool's schema would: a
      // case the plan does not have, or an expectation that is not one, is
      // left out rather than failing the step.
      const known = manager.get(session_id).plan.cases;
      const playing =
        decision.case !== undefined && known.has(decision.case)
          ? decision.case
          : undefined;
      const expect =
        decision.expect && !malformed(decision.expect)
          ? decision.expect
          : undefined;
      last = await hauntAct(manager, {
        session_id,
        actions,
        issues,
        ...(playing !== undefined ? { case: playing } : {}),
        ...(expect ? { expect } : {}),
      });
      log(describeOutcome(last).replace(/^/gm, '    '));
      if (last.steps_remaining <= 0) break;
    }

    // One more question, no more actions: what did the last step show?
    if (last) {
      // If the model fumbles this last answer, the session's findings so far
      // are worth more than the error.
      const { issues } = await decide(
        tester,
        `${describeState(await read(), steps, steps, authenticated, last)}\n\n${WRAP_UP}`,
      ).catch(() => ({ issues: [] as Issue[] }));
      finalIssues = issues;
      log(`wrap-up: ${issues.length} more issue(s)`);
    }
  } catch (error) {
    // The browser must not outlive a session that failed half-way.
    if (manager.has(session_id)) {
      await hauntEndSession(manager, { session_id }).catch(() => {});
    }
    throw error;
  }

  const endResult = await hauntEndSession(manager, {
    session_id,
    issues: finalIssues,
  });

  return {
    area: targetUrl,
    overall_impression: endResult.overall_impression,
    issues: endResult.issues_found,
    rejected: endResult.rejected,
    signal_verification: endResult.signal_verification,
    sandbox_blocked_requests: endResult.sandbox_blocked_requests,
    signals: endResult.signals,
    cases: endResult.cases,
    inventory: endResult.inventory,
  };
}

export interface HeadlessRunResult {
  report: GenerateReportOutput;
  failures: string[];
  // 1 for a critical or major issue, or a major signal no issue took up
  // (R-S22): a model that reports nothing cannot turn a server error into a
  // passing build. Only what a replay confirmed counts (R-E12): nor can a
  // model that imagines one fail it.
  exitCode: 0 | 1;
}

export async function runHeadlessTest(
  decide: ActionDecider,
  manager: SessionManager,
  options: Pick<
    CliOptions,
    'targetUrl' | 'personas' | 'steps' | 'headless' | 'verbose' | 'hostile'
  > & {
    cookies?: Cookie[];
    // The budget of actions, when it is not five per decision.
    budget?: number;
    // The description of the app, read already, and what to call it.
    spec?: { name: string; text: string };
  },
): Promise<HeadlessRunResult> {
  // One area for now: the URL given.
  const areas = [options.targetUrl];
  const settled = await Promise.allSettled(
    areas.map((area) =>
      runSession(
        decide,
        manager,
        area,
        options,
        options.verbose ? (line) => console.error(line) : undefined,
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
      failures.push(`${areas[i]}: ${message}`);
    }
  });

  if (sessions.length === 0) {
    throw new Error(`All sessions failed: ${failures.join('; ')}`);
  }

  const report = hauntGenerateReport({
    target_url: options.targetUrl,
    // Only for the file's name, which a caller written before part 4 may
    // rely on.
    personas: options.personas,
    spec: options.spec?.name,
    sessions,
  });

  const blocking =
    report.counts.critical > 0 ||
    report.counts.major > 0 ||
    report.confirmed_major_signals > 0;
  return { report, failures, exitCode: blocking ? 1 : 0 };
}

// Invoked by bin.ts — the only module that calls it, so importing this file
// (from tests, or from benchmark/run.ts) never starts a run.
export type Runner = 'claude-code' | 'api';

// Which way to run. The Claude Code account is the default wherever Claude
// Code is installed: no key to manage, and the same command as interactive
// use. An API key is the fallback, or an explicit choice.
export function chooseRunner(
  options: Pick<CliOptions, 'provider'>,
  env: NodeJS.ProcessEnv,
  claudeCodeAvailable: boolean,
): Runner {
  if (options.provider === 'claude-code') {
    if (!claudeCodeAvailable) {
      throw new Error(
        '--provider claude-code needs the `claude` command on the PATH. Install Claude Code, or use --provider anthropic|mistral with an API key.',
      );
    }
    return 'claude-code';
  }
  if (options.provider) return 'api';
  if (claudeCodeAvailable) return 'claude-code';
  if (env.ANTHROPIC_API_KEY || env.MISTRAL_API_KEY) return 'api';
  throw new Error(
    'Nothing to run with. Install Claude Code (haunt-ci then uses its account), or set ANTHROPIC_API_KEY or MISTRAL_API_KEY (a .env file is loaded automatically).',
  );
}

export async function main() {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  let runner: Runner;
  try {
    runner = chooseRunner(options, process.env, isClaudeCodeAvailable());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  if (runner === 'claude-code') {
    console.error(
      '[haunt-ci] running /haunt-test through Claude Code, on its account',
    );
    const run = await runViaClaudeCode(options);
    (run.exitCode === 2 ? console.error : console.log)(run.output);
    process.exit(run.exitCode);
  }

  let resolved: ResolvedProvider;
  try {
    resolved = resolveProvider(
      {
        provider: options.provider as Provider | undefined,
        model: options.model,
      },
      process.env,
    );
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

  let spec: { name: string; text: string } | undefined;
  if (options.specPath) {
    try {
      spec = {
        name: basename(options.specPath),
        text: readFileSync(options.specPath, 'utf-8'),
      };
    } catch {
      console.error(`haunt-ci failed: cannot read --spec ${options.specPath}`);
      process.exit(2);
    }
  }

  try {
    const { report, failures, exitCode } = await runHeadlessTest(
      decide,
      manager,
      {
        ...options,
        // --steps is the budget of actions: at most as many decisions.
        budget: options.steps,
        cookies,
        spec,
      },
    );
    for (const failure of failures) {
      console.error(`skipped ${failure}`);
    }
    console.log(report.summary);
    process.exit(exitCode);
  } catch (error) {
    console.error(
      'haunt-ci failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(2);
  }
}
