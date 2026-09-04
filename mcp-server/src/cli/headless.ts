#!/usr/bin/env node
// mcp-server/src/cli/headless.ts
//
// Standalone, non-interactive entrypoint: everything commands/haunt-test.md does
// through an interactive Claude Code session, but callable from a shell/CI pipeline
// with no orchestrating agent. Persona action decisions come from a direct Anthropic
// API call per step instead of the host LLM — this is the piece the README's
// "add personas, run it in CI" line needed and didn't have (see the audit's Majeur
// on this).
//
// Scope for this first version: tests exactly the one URL given, across the given
// personas, in parallel. It does not do the interactive command's Phase 1 route
// discovery (scouting up to 4 areas from real links) — that's a reasonable next
// step, not implemented here to keep this landing as a working, honestly-scoped v1.
import Anthropic from '@anthropic-ai/sdk';
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
import type { Issue } from '../types.js';

export interface CliOptions {
  targetUrl: string;
  personas: string[];
  steps: number;
  model: string;
  headless: boolean;
}

const USAGE =
  'Usage: haunt-ci <url> [--personas p1,p2] [--steps N] [--model id] [--headed]';

const VALUED_FLAGS = ['personas', 'steps', 'model'];

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
  const model =
    getFlag('model') ?? process.env.HAUNT_CI_MODEL ?? 'claude-opus-5';
  const headless = !argv.includes('--headed');

  return { targetUrl, personas, steps, model, headless };
}

const DECIDE_ACTION_TOOL: Anthropic.Tool = {
  name: 'decide_action',
  description:
    'Choose the single next browser action to take as this persona, and report any issues observed on the current page state.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'Natural-language action: "click <target>", "fill <text> in <field>", "goto <url>", or "press <key>"',
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['critical', 'major', 'minor', 'suggestion'],
            },
            category: {
              type: 'string',
              enum: [
                'ux',
                'accessibility',
                'performance',
                'security',
                'content',
              ],
            },
            description: { type: 'string' },
            page_url: { type: 'string' },
            recommendation: { type: 'string' },
          },
          required: [
            'severity',
            'category',
            'description',
            'page_url',
            'recommendation',
          ],
        },
      },
    },
    required: ['action'],
  },
};

export async function decideAction(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  stateDescription: string,
): Promise<{ action: string; issues: Issue[] }> {
  const response = await client.messages.create({
    model,
    max_tokens: 4_096,
    output_config: { effort: 'low' },
    system: systemPrompt,
    tools: [DECIDE_ACTION_TOOL],
    tool_choice: { type: 'tool', name: 'decide_action' },
    messages: [{ role: 'user', content: stateDescription }],
  });

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!block) {
    throw new Error(
      `Model did not return a decide_action tool call (stop_reason: ${response.stop_reason})`,
    );
  }

  const input = block.input as { action?: string; issues?: Issue[] };
  if (!input.action) {
    throw new Error('decide_action tool call was missing "action"');
  }

  return { action: input.action, issues: input.issues ?? [] };
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
  client: Anthropic,
  model: string,
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

    const { action, issues } = await decideAction(
      client,
      model,
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
  client: Anthropic,
  manager: SessionManager,
  options: CliOptions,
): Promise<HeadlessRunResult> {
  const settled = await Promise.allSettled(
    options.personas.map((persona) =>
      runPersonaSession(
        client,
        options.model,
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

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is required to run haunt in headless/CI mode (this mode calls the Anthropic API directly, outside any Claude Code session).',
    );
    process.exit(2);
  }

  const client = new Anthropic();
  const manager = new SessionManager();

  try {
    const { report, failures } = await runHeadlessTest(
      client,
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

// Only auto-run when executed directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
