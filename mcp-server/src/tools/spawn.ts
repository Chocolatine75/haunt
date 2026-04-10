// mcp-server/src/tools/spawn.ts
import { chromium } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { loadPersona } from '../persona/loader.js';
import type { SessionManager } from '../session/manager.js';
import type { HauntSession } from '../types.js';

export interface SpawnInput {
  persona: string;
  target_url: string;
  headless?: boolean;
  timeout?: number;
}

export interface SpawnOutput {
  session_id: string;
  persona_name: string;
  persona_goal: string;
  persona_description: string;
}

export async function hauntSpawn(
  manager: SessionManager,
  input: SpawnInput,
): Promise<SpawnOutput> {
  const personaConfig = loadPersona(input.persona);
  const sessionId = uuidv4();

  const browser = await chromium.launch({
    headless: input.headless ?? personaConfig.browser.headless,
  });

  const context = await browser.newContext({
    viewport: personaConfig.browser.viewport ?? { width: 1280, height: 720 },
    locale: personaConfig.browser.locale,
  });

  const page = await context.newPage();

  // Capture console errors and network failures via Playwright events
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('requestfailed', (request) => {
    networkErrors.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });

  try {
    await page.goto(input.target_url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
  } catch {
    await browser.close();
    throw new Error(
      `${input.target_url} is not reachable. Make sure your dev server is running.`,
    );
  }

  const session: HauntSession = {
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
    network_errors: networkErrors,
  };

  manager.set(sessionId, session);

  return {
    session_id: sessionId,
    persona_name: personaConfig.name,
    persona_goal: personaConfig.scenarios[0]?.goal ?? 'Explore the application',
    persona_description: personaConfig.system_prompt,
  };
}
