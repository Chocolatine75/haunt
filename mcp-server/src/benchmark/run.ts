#!/usr/bin/env node
// mcp-server/src/benchmark/run.ts
//
// Scores a haunt report against known ground-truth bugs for a target app.
// Reuses haunt-ci's machinery (runHeadlessTest, resolveProvider, createDecider)
// to produce the report, then adds one more LLM call (the "judge") to
// semantically match reported issues against ground truth, plus a
// deterministic format check. This is what turns "it seems to work now"
// into a repeatable, scriptable signal for report-quality regressions.
//
// Run from the repo root so the default ground-truth path resolves, or pass
// --ground-truth explicitly. Costs one real LLM API call for the persona loop
// plus one for the judge, same provider/key rules as haunt-ci.
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { Mistral } from '@mistralai/mistralai';
import {
  type Provider,
  type ResolvedProvider,
  createDecider,
  resolveProvider,
  runHeadlessTest,
} from '../cli/headless.js';
import type { ActionDecider } from '../cli/providers/types.js';
import { isMainModule } from '../is-main-module.js';
import { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';
import { checkReportFormat } from './format-check.js';
import { loadGroundTruth } from './ground-truth.js';
import { createAnthropicJudge } from './judge/anthropic.js';
import { createMistralJudge } from './judge/mistral.js';
import type { ReportJudge } from './judge/types.js';

export interface BenchmarkOptions {
  targetUrl: string;
  groundTruthPath: string;
  provider?: Provider;
  model?: string;
  outPath?: string;
}

const USAGE =
  'Usage: haunt-benchmark [url] [--ground-truth path] [--provider anthropic|mistral] [--model id] [--out path]';
const DEFAULT_TARGET_URL = 'http://localhost:3000';
const DEFAULT_GROUND_TRUTH_PATH = 'demo/benchmark-ground-truth.json';
const BENCHMARK_PERSONA = 'confused-beginner';
const BENCHMARK_STEPS = 3;

const VALUED_FLAGS = ['ground-truth', 'provider', 'model', 'out'];

export function parseArgs(argv: string[]): BenchmarkOptions {
  const getFlag = (name: string): string | undefined => {
    const idx = argv.indexOf(`--${name}`);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };

  const consumedValueIndices = new Set(
    VALUED_FLAGS.map((name) => argv.indexOf(`--${name}`))
      .filter((idx) => idx !== -1)
      .map((idx) => idx + 1),
  );
  const targetUrl =
    argv.find((a, i) => !a.startsWith('--') && !consumedValueIndices.has(i)) ??
    DEFAULT_TARGET_URL;

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

  return {
    targetUrl,
    groundTruthPath: getFlag('ground-truth') ?? DEFAULT_GROUND_TRUTH_PATH,
    provider: providerFlag as Provider | undefined,
    model: getFlag('model'),
    outPath: getFlag('out'),
  };
}

function createJudge(resolved: ResolvedProvider): ReportJudge {
  if (resolved.provider === 'anthropic') {
    return createAnthropicJudge(new Anthropic(), resolved.model);
  }
  return createMistralJudge(
    new Mistral({ apiKey: process.env.MISTRAL_API_KEY }),
    resolved.model,
  );
}

function loadReportIssues(reportPath: string): Issue[] {
  const sidecarPath = reportPath.endsWith('.md')
    ? `${reportPath.slice(0, -3)}.json`
    : `${reportPath}.json`;
  const parsed = JSON.parse(readFileSync(sidecarPath, 'utf-8'));
  return parsed.issues as Issue[];
}

export interface Scorecard {
  target_url: string;
  report_path: string;
  ground_truth_total: number;
  recall: number;
  missed_ground_truth_ids: string[];
  false_positive_count: number;
  total_issues: number;
  actionable_count: number;
  format_ok: boolean;
  format_missing: string[];
  judge_reasoning: string;
}

export async function runBenchmark(
  decide: ActionDecider,
  judge: ReportJudge,
  manager: SessionManager,
  options: Pick<BenchmarkOptions, 'targetUrl' | 'groundTruthPath'>,
): Promise<Scorecard> {
  const groundTruth = loadGroundTruth(options.groundTruthPath);

  const { report } = await runHeadlessTest(decide, manager, {
    targetUrl: options.targetUrl,
    personas: [BENCHMARK_PERSONA],
    steps: BENCHMARK_STEPS,
    headless: true,
  });

  const issues = loadReportIssues(report.report_path);
  const format = checkReportFormat(report.markdown);
  const verdict = await judge(groundTruth, issues);

  return {
    target_url: options.targetUrl,
    report_path: report.report_path,
    ground_truth_total: groundTruth.length,
    recall: verdict.matched.length,
    missed_ground_truth_ids: verdict.missed_ground_truth_ids,
    false_positive_count: verdict.false_positives.length,
    total_issues: issues.length,
    actionable_count: verdict.actionable_count,
    format_ok: format.ok,
    format_missing: format.missing,
    judge_reasoning: verdict.reasoning,
  };
}

function printScorecard(scorecard: Scorecard): void {
  const rule = '-'.repeat(40);
  const lines = [
    rule,
    `target: ${scorecard.target_url}`,
    `report: ${scorecard.report_path}`,
    `recall: ${scorecard.recall}/${scorecard.ground_truth_total}`,
    scorecard.missed_ground_truth_ids.length > 0
      ? `missed: ${scorecard.missed_ground_truth_ids.join(', ')}`
      : 'missed: none',
    `false positives: ${scorecard.false_positive_count}`,
    `actionable: ${scorecard.actionable_count}/${scorecard.total_issues}`,
    `format: ${
      scorecard.format_ok
        ? 'ok'
        : `FAILED (${scorecard.format_missing.join(', ')})`
    }`,
    '',
    'judge reasoning:',
    scorecard.judge_reasoning,
    rule,
  ];
  console.log(lines.join('\n'));
}

async function main() {
  let options: BenchmarkOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  let resolved: ResolvedProvider;
  try {
    resolved = resolveProvider(options, process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  console.error(
    `[haunt-benchmark] provider: ${resolved.provider}, model: ${resolved.model}`,
  );

  const decide = createDecider(resolved);
  const judge = createJudge(resolved);
  const manager = new SessionManager();

  try {
    const scorecard = await runBenchmark(decide, judge, manager, options);
    printScorecard(scorecard);
    if (options.outPath) {
      writeFileSync(
        options.outPath,
        JSON.stringify(scorecard, null, 2),
        'utf-8',
      );
    }
    process.exit(0);
  } catch (error) {
    console.error(
      'haunt-benchmark failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(2);
  }
}

if (isMainModule(import.meta.url)) {
  main();
}
