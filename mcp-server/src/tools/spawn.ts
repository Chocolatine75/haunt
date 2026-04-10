// mcp-server/src/tools/spawn.ts
import { Stagehand } from '@browserbasehq/stagehand';
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
  persona_summary: string;
}

export async function hauntSpawn(
  manager: SessionManager,
  input: SpawnInput,
): Promise<SpawnOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Set it in your environment and restart Claude Code.',
    );
  }

  const personaConfig = loadPersona(input.persona);
  const sessionId = uuidv4();

  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 0,
    headless: input.headless ?? personaConfig.browser.headless,
    modelName: 'claude-3-5-haiku-20241022',
    modelClientOptions: { apiKey: process.env.ANTHROPIC_API_KEY },
  });

  await stagehand.init();

  // Capture console errors and network failures via Playwright events
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  stagehand.page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  stagehand.page.on('requestfailed', (request) => {
    networkErrors.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });

  try {
    await stagehand.page.goto(input.target_url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
  } catch {
    await stagehand.close();
    throw new Error(
      `${input.target_url} is not reachable. Make sure your dev server is running.`,
    );
  }

  const session: HauntSession = {
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
    network_errors: networkErrors,
  };

  manager.set(sessionId, session);

  return {
    session_id: sessionId,
    persona_summary: `${personaConfig.name}: ${personaConfig.description}`,
  };
}
