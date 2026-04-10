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
import { chromium } from "playwright";
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
  const personaConfig = loadPersona(input.persona);
  const sessionId = uuidv4();
  const browser = await chromium.launch({
    headless: input.headless ?? personaConfig.browser.headless
  });
  const context = await browser.newContext({
    viewport: personaConfig.browser.viewport ?? { width: 1280, height: 720 },
    locale: personaConfig.browser.locale
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (request) => {
    networkErrors.push(
      `${request.method()} ${request.url()} \u2014 ${request.failure()?.errorText ?? "unknown"}`
    );
  });
  try {
    await page.goto(input.target_url, {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
  } catch {
    await browser.close();
    throw new Error(
      `${input.target_url} is not reachable. Make sure your dev server is running.`
    );
  }
  const session = {
    id: sessionId,
    persona: personaConfig,
    browser,
    page,
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
    persona_name: personaConfig.name,
    persona_goal: personaConfig.scenarios[0]?.goal ?? "Explore the application",
    persona_description: personaConfig.system_prompt
  };
}

// src/tools/navigate.ts
import { mkdirSync } from "fs";
var SCREENSHOTS_DIR = ".haunt-reports/screenshots";
async function executeAction(page, action) {
  const trimmed = action.trim();
  if (/^(goto|navigate to|go to)\s+/i.test(trimmed)) {
    const url = trimmed.replace(/^(goto|navigate to|go to)\s+/i, "").trim();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15e3 });
    return;
  }
  if (/^(press|hit|key)\s+/i.test(trimmed)) {
    const key = trimmed.replace(/^(press|hit|key)\s+/i, "").trim();
    await page.keyboard.press(key);
    return;
  }
  const fillMatch = trimmed.match(/^(?:fill|type|enter|input)\s+(.+?)\s+in(?:to)?\s+(.+)/i);
  if (fillMatch) {
    const text = fillMatch[1].replace(/^['"]|['"]$/g, "");
    const field = fillMatch[2].replace(/^['"]|['"]$/g, "");
    const loc = page.getByLabel(field, { exact: false }).or(page.getByPlaceholder(field, { exact: false })).or(page.getByRole("textbox", { name: field }));
    await loc.first().fill(text);
    return;
  }
  const clickTarget = trimmed.replace(/^(click|tap|select)\s+/i, "").trim();
  for (const role of ["button", "link", "menuitem", "tab", "option"]) {
    try {
      await page.getByRole(role, { name: clickTarget, exact: false }).first().click({ timeout: 3e3 });
      return;
    } catch {
    }
  }
  await page.getByText(clickTarget, { exact: false }).first().click({ timeout: 5e3 });
}
async function hauntNavigate(manager, input) {
  const session = manager.get(input.session_id);
  const { page } = session;
  if (input.issues?.length) {
    session.issues.push(...input.issues);
  }
  const stepConsoleErrors = session.console_errors.splice(0);
  const stepNetworkErrors = session.network_errors.splice(0);
  session.step_count++;
  let screenshotPath;
  try {
    await executeAction(page, input.action);
  } catch (error) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    screenshotPath = `${session.id}-step-${session.step_count}.png`;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshotPath}` });
    const issue = {
      severity: "major",
      category: "ux",
      description: `Action failed: "${input.action}". ${error instanceof Error ? error.message : String(error)}`,
      page_url: page.url(),
      screenshot_path: screenshotPath,
      recommendation: "Ensure this interaction is reachable and clearly labeled."
    };
    session.issues.push(issue);
    return {
      success: false,
      page_url: page.url(),
      page_title: await page.title(),
      console_errors: stepConsoleErrors,
      network_errors: stepNetworkErrors,
      screenshot_path: screenshotPath,
      error: error instanceof Error ? error.message : String(error),
      step: session.step_count,
      steps_remaining: session.max_steps - session.step_count
    };
  }
  const currentUrl = page.url();
  session.pages_visited.push(currentUrl);
  return {
    success: true,
    page_url: currentUrl,
    page_title: await page.title(),
    console_errors: stepConsoleErrors,
    network_errors: stepNetworkErrors,
    screenshot_path: screenshotPath,
    step: session.step_count,
    steps_remaining: session.max_steps - session.step_count
  };
}

// src/tools/capture.ts
import { mkdirSync as mkdirSync2 } from "fs";
var SCREENSHOTS_DIR2 = ".haunt-reports/screenshots";
async function hauntCaptureState(manager, input) {
  const session = manager.get(input.session_id);
  const { page } = session;
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
    const snapshot = await page.accessibility.snapshot();
    accessibility_tree = JSON.stringify(snapshot, null, 2).slice(0, 4e3);
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
  await session.browser.close();
  const duration_seconds = Math.round((Date.now() - session.start_time) / 1e3);
  const output = {
    session_id: session.id,
    persona: session.persona.name,
    duration_seconds,
    pages_visited: session.pages_visited.length,
    step_count: session.step_count,
    issues_found: session.issues,
    overall_impression: input.overall_impression ?? `Completed ${session.step_count} steps across ${session.pages_visited.length} pages.`
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
        description: "Open a browser session for a persona and navigate to the target URL. Returns persona details (name, goal, system prompt) so the orchestrator can roleplay as that persona.",
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
        description: 'Execute a browser action decided by the orchestrator (as the persona). Actions: "click <target>", "fill <text> in <field>", "goto <url>", "press <key>".',
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Session ID from haunt_spawn" },
            action: {
              type: "string",
              description: 'Action to perform, e.g. "click Login", "fill test@example.com in Email", "goto http://localhost:3000/about", "press Enter"'
            },
            issues: {
              type: "array",
              description: "Issues the orchestrator observed during this step",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["critical", "major", "minor", "suggestion"] },
                  category: { type: "string", enum: ["ux", "accessibility", "performance", "security", "content"] },
                  description: { type: "string" },
                  page_url: { type: "string" },
                  recommendation: { type: "string" }
                },
                required: ["severity", "category", "description", "page_url", "recommendation"]
              }
            }
          },
          required: ["session_id", "action"]
        }
      },
      {
        name: "haunt_capture_state",
        description: "Capture the current page state: accessibility tree, optional screenshot, optional DOM. Call this before deciding each action.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            include_screenshot: { type: "boolean", description: "Default: true" },
            include_dom: {
              type: "boolean",
              description: "Include raw HTML snapshot (capped at 5000 chars). Default: false"
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "haunt_end_session",
        description: "Close the browser session and return the structured report of all issues found.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            overall_impression: {
              type: "string",
              description: "The orchestrator's summary of the session from the persona's perspective"
            }
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
