#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import {
  SessionManager,
  hauntCaptureState,
  hauntEndSession,
  hauntGenerateReport,
  hauntNavigate,
  hauntSpawn
} from "./chunk-O4IATY6Q.js";
import {
  Anthropic
} from "./chunk-E7XYLEIO.js";
import "./chunk-7ZHFVULC.js";

// src/cli/headless.ts
var USAGE = "Usage: haunt-ci <url> [--personas p1,p2] [--steps N] [--model id] [--headed]";
var VALUED_FLAGS = ["personas", "steps", "model"];
function parseArgs(argv) {
  const getFlag = (name) => {
    const idx = argv.indexOf(`--${name}`);
    return idx !== -1 ? argv[idx + 1] : void 0;
  };
  const consumedValueIndices = new Set(
    VALUED_FLAGS.map((name) => argv.indexOf(`--${name}`)).filter((idx) => idx !== -1).map((idx) => idx + 1)
  );
  const targetUrl = argv.find(
    (a, i) => !a.startsWith("--") && !consumedValueIndices.has(i)
  );
  if (!targetUrl) {
    throw new Error(USAGE);
  }
  const personas = (getFlag("personas") ?? "confused-beginner").split(",").map((s) => s.trim()).filter(Boolean);
  const steps = Number(getFlag("steps") ?? "3");
  if (!Number.isFinite(steps) || steps < 1) {
    throw new Error(
      `--steps must be a positive number, got: ${getFlag("steps")}`
    );
  }
  const model = getFlag("model") ?? process.env.HAUNT_CI_MODEL ?? "claude-opus-5";
  const headless = !argv.includes("--headed");
  return { targetUrl, personas, steps, model, headless };
}
var DECIDE_ACTION_TOOL = {
  name: "decide_action",
  description: "Choose the single next browser action to take as this persona, and report any issues observed on the current page state.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: 'Natural-language action: "click <target>", "fill <text> in <field>", "goto <url>", or "press <key>"'
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: {
              type: "string",
              enum: ["critical", "major", "minor", "suggestion"]
            },
            category: {
              type: "string",
              enum: [
                "ux",
                "accessibility",
                "performance",
                "security",
                "content"
              ]
            },
            description: { type: "string" },
            page_url: { type: "string" },
            recommendation: { type: "string" }
          },
          required: [
            "severity",
            "category",
            "description",
            "page_url",
            "recommendation"
          ]
        }
      }
    },
    required: ["action"]
  }
};
async function decideAction(client, model, systemPrompt, stateDescription) {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: systemPrompt,
    tools: [DECIDE_ACTION_TOOL],
    tool_choice: { type: "tool", name: "decide_action" },
    messages: [{ role: "user", content: stateDescription }]
  });
  const block = response.content.find(
    (b) => b.type === "tool_use"
  );
  if (!block) {
    throw new Error(
      `Model did not return a decide_action tool call (stop_reason: ${response.stop_reason})`
    );
  }
  const input = block.input;
  if (!input.action) {
    throw new Error('decide_action tool call was missing "action"');
  }
  return { action: input.action, issues: input.issues ?? [] };
}
function describeState(url, title, accessibilityTree, accessibilityTreeError, step, steps) {
  const treeSection = accessibilityTree ? accessibilityTree : `(unavailable: ${accessibilityTreeError ?? "unknown error"})`;
  return `URL: ${url}
Title: ${title}
Step ${step} of ${steps}

Accessibility tree:
${treeSection}`;
}
async function runPersonaSession(client, model, manager, personaName, targetUrl, steps, headless) {
  const spawnResult = await hauntSpawn(manager, {
    persona: personaName,
    target_url: targetUrl,
    headless,
    timeout: steps
  });
  for (let step = 1; step <= steps; step++) {
    const state = await hauntCaptureState(manager, {
      session_id: spawnResult.session_id,
      include_screenshot: false,
      include_dom: false
    });
    const stateDescription = describeState(
      state.url,
      state.title,
      state.accessibility_tree,
      state.accessibility_tree_error,
      step,
      steps
    );
    const { action, issues } = await decideAction(
      client,
      model,
      spawnResult.persona_description,
      stateDescription
    );
    await hauntNavigate(manager, {
      session_id: spawnResult.session_id,
      action,
      issues
    });
  }
  const endResult = await hauntEndSession(manager, {
    session_id: spawnResult.session_id
  });
  return {
    area: targetUrl,
    persona: spawnResult.persona_name,
    overall_impression: endResult.overall_impression,
    issues: endResult.issues_found
  };
}
async function runHeadlessTest(client, manager, options) {
  const settled = await Promise.allSettled(
    options.personas.map(
      (persona) => runPersonaSession(
        client,
        options.model,
        manager,
        persona,
        options.targetUrl,
        options.steps,
        options.headless
      )
    )
  );
  const sessions = [];
  const failures = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sessions.push(result.value);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`${options.personas[i]}: ${message}`);
    }
  });
  if (sessions.length === 0) {
    throw new Error(`All persona sessions failed: ${failures.join("; ")}`);
  }
  const report = hauntGenerateReport({
    target_url: options.targetUrl,
    personas: options.personas,
    sessions
  });
  return { report, failures };
}
async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is required to run haunt in headless/CI mode (this mode calls the Anthropic API directly, outside any Claude Code session)."
    );
    process.exit(2);
  }
  const client = new Anthropic();
  const manager = new SessionManager();
  try {
    const { report, failures } = await runHeadlessTest(
      client,
      manager,
      options
    );
    for (const failure of failures) {
      console.error(`skipped ${failure}`);
    }
    console.log(report.summary);
    const blocking = report.counts.critical > 0 || report.counts.major > 0;
    process.exit(blocking ? 1 : 0);
  } catch (error) {
    console.error(
      "haunt-ci failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(2);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
export {
  decideAction,
  parseArgs,
  runHeadlessTest
};
