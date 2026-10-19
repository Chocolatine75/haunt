#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import {
  Mistral,
  authenticate,
  createDecider,
  resolveProvider,
  runHeadlessTest
} from "./chunk-TZ4Z5O4Y.js";
import {
  SessionManager
} from "./chunk-67657I6A.js";
import {
  Anthropic
} from "./chunk-MMWLM6BK.js";
import "./chunk-3IGCGY6U.js";
import "./chunk-5HT2UXVQ.js";
import "./chunk-ZO3ASFWY.js";

// src/benchmark/run.ts
import { readFileSync as readFileSync2, writeFileSync } from "fs";

// src/benchmark/format-check.ts
var REQUIRED_FRONTMATTER_FIELDS = [
  "haunt:",
  "target:",
  "date:",
  "areas_tested:",
  "issues:",
  "top_fix:"
];
var REQUIRED_SECTION_HEADERS = [
  "## Issues",
  "## Session Impressions",
  "## For Claude"
];
function checkReportFormat(markdown) {
  const missing = [];
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    missing.push("frontmatter block (--- ... ---)");
  } else {
    const frontmatter = frontmatterMatch[1];
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      if (!frontmatter.includes(field)) {
        missing.push(`frontmatter field "${field}"`);
      }
    }
  }
  for (const header of REQUIRED_SECTION_HEADERS) {
    if (!markdown.includes(header)) {
      missing.push(`section "${header}"`);
    }
  }
  return { ok: missing.length === 0, missing };
}

// src/benchmark/ground-truth.ts
import { readFileSync } from "fs";
var VALID_CATEGORIES = [
  "ux",
  "accessibility",
  "performance",
  "security",
  "content"
];
function findInvalidField(entry) {
  if (typeof entry !== "object" || entry === null) {
    return "entry";
  }
  const candidate = entry;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    return "id";
  }
  if (typeof candidate.route !== "string") {
    return "route";
  }
  if (typeof candidate.description !== "string" || candidate.description.length === 0) {
    return "description";
  }
  if (typeof candidate.category !== "string" || !VALID_CATEGORIES.includes(candidate.category)) {
    return "category";
  }
  return void 0;
}
function loadGroundTruth(path) {
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `${path} does not contain a JSON array of ground-truth bugs`
    );
  }
  for (let i = 0; i < parsed.length; i++) {
    const invalidField = findInvalidField(parsed[i]);
    if (invalidField) {
      throw new Error(
        `${path}: entry at index ${i} is missing or has an invalid "${invalidField}"`
      );
    }
  }
  return parsed;
}

// src/benchmark/judge/types.ts
var SCORE_REPORT_TOOL_NAME = "score_report";
var SCORE_REPORT_TOOL_DESCRIPTION = "Score a haunt bug report against a list of known, ground-truth bugs: which ground-truth bugs a reported issue actually corresponds to, which reported issues are false positives (including tooling artifacts \u2014 e.g. a failed click misreported as an app bug, not a real product issue), and how many of the reported issues have a concrete, actionable fix recommendation rather than a vague one.";
function scoreReportParameters() {
  return {
    type: "object",
    properties: {
      matched: {
        type: "array",
        description: "Ground-truth bugs that a reported issue actually corresponds to",
        items: {
          type: "object",
          properties: {
            ground_truth_id: { type: "string" },
            matched_issue_description: {
              type: "string",
              description: "The description of the reported issue that matches this ground-truth bug"
            }
          },
          required: ["ground_truth_id", "matched_issue_description"]
        }
      },
      missed_ground_truth_ids: {
        type: "array",
        items: { type: "string" },
        description: "IDs of ground-truth bugs that no reported issue corresponds to"
      },
      false_positives: {
        type: "array",
        description: "Reported issues that do not correspond to any real, ground-truth bug",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            reason: { type: "string" }
          },
          required: ["description", "reason"]
        }
      },
      actionable_count: {
        type: "number",
        description: "How many of the TOTAL reported issues (not just matched ones) have a concrete, actionable fix recommendation"
      },
      reasoning: {
        type: "string",
        description: "One paragraph explaining the scoring, for a human to sanity-check"
      }
    },
    required: [
      "matched",
      "missed_ground_truth_ids",
      "false_positives",
      "actionable_count",
      "reasoning"
    ]
  };
}
function buildJudgePrompt(groundTruth, issues) {
  return [
    "Ground-truth bugs known to exist in the app:",
    JSON.stringify(groundTruth, null, 2),
    "",
    "Issues reported in the haunt test report being scored:",
    JSON.stringify(issues, null, 2),
    "",
    "Score this report by calling score_report."
  ].join("\n");
}
function parseScoreReportInput(input) {
  const parsed = input;
  if (!Array.isArray(parsed.matched) || !Array.isArray(parsed.missed_ground_truth_ids) || !Array.isArray(parsed.false_positives) || typeof parsed.actionable_count !== "number" || typeof parsed.reasoning !== "string") {
    throw new Error(
      `${SCORE_REPORT_TOOL_NAME} tool call was missing one or more required fields`
    );
  }
  return {
    matched: parsed.matched,
    missed_ground_truth_ids: parsed.missed_ground_truth_ids,
    false_positives: parsed.false_positives,
    actionable_count: parsed.actionable_count,
    reasoning: parsed.reasoning
  };
}

// src/benchmark/judge/anthropic.ts
function createAnthropicJudge(client, model) {
  const tool = {
    name: SCORE_REPORT_TOOL_NAME,
    description: SCORE_REPORT_TOOL_DESCRIPTION,
    input_schema: scoreReportParameters()
  };
  return async (groundTruth, issues) => {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [tool],
      tool_choice: { type: "tool", name: SCORE_REPORT_TOOL_NAME },
      messages: [
        { role: "user", content: buildJudgePrompt(groundTruth, issues) }
      ]
    });
    const block = response.content.find(
      (b) => b.type === "tool_use"
    );
    if (!block) {
      throw new Error(
        `Model did not return a ${SCORE_REPORT_TOOL_NAME} tool call (stop_reason: ${response.stop_reason})`
      );
    }
    return parseScoreReportInput(block.input);
  };
}

// src/benchmark/judge/mistral.ts
function createMistralJudge(client, model) {
  const tool = {
    type: "function",
    function: {
      name: SCORE_REPORT_TOOL_NAME,
      description: SCORE_REPORT_TOOL_DESCRIPTION,
      parameters: scoreReportParameters()
    }
  };
  return async (groundTruth, issues) => {
    const response = await client.chat.complete({
      model,
      tools: [tool],
      toolChoice: {
        type: "function",
        function: { name: SCORE_REPORT_TOOL_NAME }
      },
      messages: [
        { role: "user", content: buildJudgePrompt(groundTruth, issues) }
      ]
    });
    const toolCall = response.choices[0]?.message?.toolCalls?.[0];
    if (!toolCall) {
      throw new Error(
        `Model did not return a ${SCORE_REPORT_TOOL_NAME} tool call (finish_reason: ${response.choices[0]?.finishReason})`
      );
    }
    const rawArgs = toolCall.function.arguments;
    const input = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
    return parseScoreReportInput(input);
  };
}

// src/benchmark/run.ts
var USAGE = "Usage: haunt-benchmark [url] [--ground-truth path] [--provider anthropic|mistral] [--model id] [--out path] [--email addr --password pw] [--login-url url]";
var DEFAULT_TARGET_URL = "http://localhost:3000";
var DEFAULT_GROUND_TRUTH_PATH = "demo/benchmark-ground-truth.json";
var BENCHMARK_STEPS = 3;
var VALUED_FLAGS = [
  "ground-truth",
  "provider",
  "model",
  "out",
  "email",
  "password",
  "login-url"
];
function isHelpRequested(argv) {
  return argv.includes("--help") || argv.includes("-h");
}
function parseArgs(argv) {
  const getFlag = (name) => {
    const idx = argv.indexOf(`--${name}`);
    return idx !== -1 ? argv[idx + 1] : void 0;
  };
  const consumedValueIndices = new Set(
    VALUED_FLAGS.map((name) => argv.indexOf(`--${name}`)).filter((idx) => idx !== -1).map((idx) => idx + 1)
  );
  const targetUrl = argv.find((a, i) => !a.startsWith("--") && !consumedValueIndices.has(i)) ?? DEFAULT_TARGET_URL;
  const providerFlag = getFlag("provider");
  if (providerFlag && providerFlag !== "anthropic" && providerFlag !== "mistral") {
    throw new Error(
      `--provider must be "anthropic" or "mistral", got: ${providerFlag}`
    );
  }
  const email = getFlag("email");
  const password = getFlag("password");
  if (email && !password || password && !email) {
    throw new Error("--email and --password must be given together.");
  }
  return {
    targetUrl,
    groundTruthPath: getFlag("ground-truth") ?? DEFAULT_GROUND_TRUTH_PATH,
    provider: providerFlag,
    model: getFlag("model"),
    outPath: getFlag("out"),
    email,
    password,
    loginUrl: getFlag("login-url")
  };
}
function createJudge(resolved) {
  if (resolved.provider === "anthropic") {
    return createAnthropicJudge(new Anthropic(), resolved.model);
  }
  return createMistralJudge(
    new Mistral({ apiKey: process.env.MISTRAL_API_KEY }),
    resolved.model
  );
}
function loadReportIssues(reportPath) {
  const sidecarPath = reportPath.endsWith(".md") ? `${reportPath.slice(0, -3)}.json` : `${reportPath}.json`;
  const parsed = JSON.parse(readFileSync2(sidecarPath, "utf-8"));
  return parsed.issues;
}
async function runBenchmark(decide, judge, manager, options) {
  const groundTruth = loadGroundTruth(options.groundTruthPath);
  const { report } = await runHeadlessTest(decide, manager, {
    targetUrl: options.targetUrl,
    steps: BENCHMARK_STEPS,
    headless: true,
    cookies: options.cookies
  });
  const issues = loadReportIssues(report.report_path);
  const format = checkReportFormat(report.markdown);
  const verdict = await judge(groundTruth, issues);
  const validIds = new Set(groundTruth.map((bug) => bug.id));
  const dedupedMatchedIds = /* @__PURE__ */ new Set();
  const unreconciledIds = [];
  for (const match of verdict.matched) {
    if (!validIds.has(match.ground_truth_id)) {
      unreconciledIds.push(match.ground_truth_id);
      continue;
    }
    dedupedMatchedIds.add(match.ground_truth_id);
  }
  const missedGroundTruthIds = [...validIds].filter(
    (id) => !dedupedMatchedIds.has(id)
  );
  return {
    target_url: options.targetUrl,
    report_path: report.report_path,
    ground_truth_total: groundTruth.length,
    recall: dedupedMatchedIds.size,
    missed_ground_truth_ids: missedGroundTruthIds,
    false_positive_count: verdict.false_positives.length,
    total_issues: issues.length,
    actionable_count: verdict.actionable_count,
    format_ok: format.ok,
    format_missing: format.missing,
    judge_reasoning: verdict.reasoning,
    ...unreconciledIds.length > 0 ? { unreconciled_ids: unreconciledIds } : {}
  };
}
function printScorecard(scorecard) {
  const rule = "-".repeat(40);
  const lines = [
    rule,
    `target: ${scorecard.target_url}`,
    `report: ${scorecard.report_path}`,
    `recall: ${scorecard.recall}/${scorecard.ground_truth_total}`,
    scorecard.missed_ground_truth_ids.length > 0 ? `missed: ${scorecard.missed_ground_truth_ids.join(", ")}` : "missed: none",
    `false positives: ${scorecard.false_positive_count}`,
    `actionable: ${scorecard.actionable_count}/${scorecard.total_issues}`,
    `format: ${scorecard.format_ok ? "ok" : `FAILED (${scorecard.format_missing.join(", ")})`}`,
    ...scorecard.unreconciled_ids && scorecard.unreconciled_ids.length > 0 ? [
      `judge referenced unknown ids: ${scorecard.unreconciled_ids.join(", ")}`
    ] : [],
    "",
    "judge reasoning:",
    scorecard.judge_reasoning,
    rule
  ];
  console.log(lines.join("\n"));
}
async function main() {
  const argv = process.argv.slice(2);
  if (isHelpRequested(argv)) {
    console.log(USAGE);
    process.exit(0);
    return;
  }
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }
  let resolved;
  try {
    resolved = resolveProvider(options, process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }
  console.error(
    `[haunt-benchmark] provider: ${resolved.provider}, model: ${resolved.model}`
  );
  const decide = createDecider(resolved);
  const judge = createJudge(resolved);
  const manager = new SessionManager();
  let cookies;
  if (options.email && options.password) {
    const loginUrl = options.loginUrl ?? new URL("/login", options.targetUrl).toString();
    console.error(`[haunt-benchmark] authenticating at ${loginUrl}...`);
    try {
      cookies = await authenticate(manager, {
        loginUrl,
        email: options.email,
        password: options.password,
        headless: true
      });
      console.error(
        `[haunt-benchmark] authenticated \u2014 ${cookies.length} cookie(s)`
      );
    } catch (error) {
      console.error(
        "haunt-benchmark failed: login failed \u2014",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
      return;
    }
  }
  try {
    const scorecard = await runBenchmark(decide, judge, manager, {
      ...options,
      cookies
    });
    printScorecard(scorecard);
    if (options.outPath) {
      writeFileSync(
        options.outPath,
        JSON.stringify(scorecard, null, 2),
        "utf-8"
      );
    }
    process.exit(0);
  } catch (error) {
    console.error(
      "haunt-benchmark failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(2);
  }
}

// src/benchmark/bin.ts
main();
