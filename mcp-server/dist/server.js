// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/session/manager.ts
var SessionManager = class {
  sessions = /* @__PURE__ */ new Map();
  set(id, session) {
    this.sessions.set(id, session);
  }
  get(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    return session;
  }
  delete(id) {
    if (!this.sessions.has(id)) throw new Error(`Session not found: ${id}`);
    this.sessions.delete(id);
  }
  has(id) {
    return this.sessions.has(id);
  }
  all() {
    return Array.from(this.sessions.values());
  }
};

// src/tools/spawn.ts
import { Stagehand } from "@browserbasehq/stagehand";
import { v4 as uuidv4 } from "uuid";

// src/persona/loader.ts
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { z } from "zod";
var __dirname = fileURLToPath(new URL(".", import.meta.url));
var BUILTIN_PERSONAS_DIR = process.env.HAUNT_PERSONAS_DIR ?? resolve(__dirname, "../../../personas");
var PersonaSchema = z.object({
  name: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  browser: z.object({
    headless: z.boolean().default(true),
    viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    locale: z.string().optional()
  }),
  scenarios: z.array(
    z.object({
      name: z.string(),
      goal: z.string(),
      max_steps: z.number().default(30)
    })
  ).default([{ name: "Free Exploration", goal: "Explore the application freely", max_steps: 30 }])
});
function loadPersona(nameOrPath) {
  const filePath = nameOrPath.endsWith(".yaml") || nameOrPath.endsWith(".yml") ? nameOrPath : resolve(BUILTIN_PERSONAS_DIR, `${nameOrPath}.yaml`);
  const raw = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw);
  return PersonaSchema.parse(parsed);
}

// src/tools/spawn.ts
async function hauntSpawn(manager, input) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Set it in your environment and restart Claude Code."
    );
  }
  const personaConfig = loadPersona(input.persona);
  const sessionId = uuidv4();
  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 0,
    headless: input.headless ?? personaConfig.browser.headless,
    modelName: "claude-3-5-haiku-20241022",
    modelClientOptions: { apiKey: process.env.ANTHROPIC_API_KEY }
  });
  await stagehand.init();
  const consoleErrors = [];
  const networkErrors = [];
  stagehand.page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  stagehand.page.on("requestfailed", (request) => {
    networkErrors.push(
      `${request.method()} ${request.url()} \u2014 ${request.failure()?.errorText ?? "unknown"}`
    );
  });
  try {
    await stagehand.page.goto(input.target_url, {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
  } catch {
    await stagehand.close();
    throw new Error(
      `${input.target_url} is not reachable. Make sure your dev server is running.`
    );
  }
  const session = {
    id: sessionId,
    persona: personaConfig,
    stagehand,
    messages: [],
    issues: [],
    pages_visited: [input.target_url],
    start_time: Date.now(),
    step_count: 0,
    max_steps: input.timeout ?? (personaConfig.scenarios[0]?.max_steps ?? 30),
    console_errors: consoleErrors,
    network_errors: networkErrors
  };
  manager.set(sessionId, session);
  return {
    session_id: sessionId,
    persona_summary: `${personaConfig.name}: ${personaConfig.description}`
  };
}

// src/tools/navigate.ts
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync } from "fs";
var anthropic = new Anthropic();
var SCREENSHOTS_DIR = ".haunt-reports/screenshots";
function parseHaikuResponse(raw) {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action ?? "",
        thought: parsed.thought ?? "",
        done: parsed.done ?? false
      };
    }
  } catch {
  }
  return { action: raw.slice(0, 200), thought: "", done: false };
}
async function hauntNavigate(manager, input) {
  const session = manager.get(input.session_id);
  const { stagehand, persona, messages } = session;
  const page = stagehand.page;
  if (session.step_count >= session.max_steps) {
    return {
      success: true,
      page_url: page.url(),
      page_title: await page.title(),
      console_errors: [],
      network_errors: [],
      done: true,
      step: session.step_count
    };
  }
  const recent = session.pages_visited.slice(-3);
  if (recent.length === 3 && recent.every((u) => u === page.url())) {
    return {
      success: true,
      page_url: page.url(),
      page_title: await page.title(),
      thought: "Navigation loop detected \u2014 ending session early",
      console_errors: [],
      network_errors: [],
      done: true,
      step: session.step_count
    };
  }
  let pageState;
  try {
    const observations = await page.observe({
      instruction: "Describe what is visible and what actions are available to the user"
    });
    pageState = observations.map((o) => o.description).join("; ");
  } catch {
    pageState = `title: ${await page.title()}`;
  }
  const stepConsoleErrors = session.console_errors.splice(0);
  const stepNetworkErrors = session.network_errors.splice(0);
  const userMessage = [
    `Current page: ${page.url()}`,
    `Title: ${await page.title()}`,
    `What you see: ${pageState}`,
    stepConsoleErrors.length > 0 ? `Console errors: ${stepConsoleErrors.join(" | ")}` : null,
    "",
    "Respond with JSON only:",
    '{ "action": "what you do next in natural language", "thought": "your internal reasoning as this persona", "done": false }',
    "Set done: true if your goal is complete or you are stuck."
  ].filter(Boolean).join("\n");
  const updatedMessages = [
    ...messages,
    { role: "user", content: userMessage }
  ];
  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 512,
    system: [
      persona.system_prompt,
      `Goal: ${persona.scenarios[0]?.goal ?? "Explore the application"}`
    ].join("\n\n"),
    messages: updatedMessages
  });
  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  const { action, thought, done } = parseHaikuResponse(rawText);
  session.messages = [
    ...updatedMessages,
    { role: "assistant", content: rawText }
  ];
  session.step_count++;
  if (done || !action) {
    return {
      success: true,
      page_url: page.url(),
      page_title: await page.title(),
      thought: input.think_aloud ? thought : void 0,
      console_errors: stepConsoleErrors,
      network_errors: stepNetworkErrors,
      done: true,
      step: session.step_count
    };
  }
  let screenshotPath;
  try {
    await page.act({ action });
  } catch (error) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    screenshotPath = `${session.id}-step-${session.step_count}.png`;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshotPath}` });
    const issue = {
      severity: "major",
      category: "ux",
      description: `Action failed: "${action}". ${error instanceof Error ? error.message : String(error)}`,
      page_url: page.url(),
      screenshot_path: screenshotPath,
      recommendation: "Ensure this interaction is reachable and clearly labeled for all users."
    };
    session.issues.push(issue);
  }
  const currentUrl = page.url();
  session.pages_visited.push(currentUrl);
  return {
    success: true,
    page_url: currentUrl,
    page_title: await page.title(),
    thought: input.think_aloud ? thought : void 0,
    console_errors: stepConsoleErrors,
    network_errors: stepNetworkErrors,
    screenshot_path: screenshotPath,
    done: false,
    step: session.step_count
  };
}

// src/tools/capture.ts
import { mkdirSync as mkdirSync2 } from "fs";
var SCREENSHOTS_DIR2 = ".haunt-reports/screenshots";
async function hauntCaptureState(manager, input) {
  const session = manager.get(input.session_id);
  const page = session.stagehand.page;
  const url = page.url();
  const title = await page.title();
  let screenshot_path;
  if (input.include_screenshot ?? true) {
    mkdirSync2(SCREENSHOTS_DIR2, { recursive: true });
    screenshot_path = `${session.id}-capture-${Date.now()}.png`;
    await page.screenshot({ path: `${SCREENSHOTS_DIR2}/${screenshot_path}` });
  }
  let accessibility_tree;
  try {
    const observations = await page.observe({
      instruction: "List all interactive elements and their accessible labels"
    });
    accessibility_tree = observations.map((o) => o.description).join("\n");
  } catch {
    accessibility_tree = void 0;
  }
  let dom_snapshot;
  if (input.include_dom) {
    dom_snapshot = (await page.content()).slice(0, 5e3);
  }
  return { url, title, accessibility_tree, dom_snapshot, screenshot_path };
}

// src/tools/end-session.ts
async function hauntEndSession(manager, input) {
  const session = manager.get(input.session_id);
  await session.stagehand.close();
  const duration_seconds = Math.round((Date.now() - session.start_time) / 1e3);
  const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
  const overall_impression = typeof lastAssistant?.content === "string" ? lastAssistant.content.slice(0, 300) : `Completed ${session.step_count} steps across ${session.pages_visited.length} pages.`;
  const output = {
    session_id: session.id,
    persona: session.persona.name,
    duration_seconds,
    pages_visited: session.pages_visited.length,
    step_count: session.step_count,
    issues_found: session.issues,
    overall_impression
  };
  manager.delete(input.session_id);
  return output;
}

// src/server.ts
function createServer() {
  const manager = new SessionManager();
  const server = new Server(
    { name: "haunt", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "haunt_spawn",
        description: "Create and initialize a phantom browser session for a persona",
        inputSchema: {
          type: "object",
          properties: {
            persona: {
              type: "string",
              description: "Persona name (e.g. confused-beginner) or absolute path to a YAML file"
            },
            target_url: {
              type: "string",
              description: "URL to test (e.g. http://localhost:3000)"
            },
            headless: {
              type: "boolean",
              description: "Run browser in headless mode. Default: true"
            },
            timeout: {
              type: "number",
              description: "Maximum navigation steps for this session. Default: 30"
            }
          },
          required: ["persona", "target_url"]
        }
      },
      {
        name: "haunt_navigate",
        description: "Execute one navigation step: phantom reasons via Haiku, Stagehand executes in browser",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Session ID from haunt_spawn" },
            think_aloud: {
              type: "boolean",
              description: "Include the phantom's internal reasoning in the output"
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "haunt_capture_state",
        description: "Capture a snapshot of the current page (screenshot, accessibility tree, DOM)",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            include_screenshot: { type: "boolean", description: "Default: true" },
            include_dom: { type: "boolean", description: "Include raw HTML snapshot (capped at 5000 chars). Default: false" }
          },
          required: ["session_id"]
        }
      },
      {
        name: "haunt_end_session",
        description: "Close the phantom session and return the structured report of all issues found",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" }
          },
          required: ["session_id"]
        }
      }
    ]
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      let result;
      if (name === "haunt_spawn") {
        result = await hauntSpawn(manager, args);
      } else if (name === "haunt_navigate") {
        result = await hauntNavigate(manager, args);
      } else if (name === "haunt_capture_state") {
        result = await hauntCaptureState(manager, args);
      } else if (name === "haunt_end_session") {
        result = await hauntEndSession(manager, args);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });
  return server;
}

// src/index.ts
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((error) => {
  console.error("Fatal error starting haunt MCP server:", error);
  process.exit(1);
});
