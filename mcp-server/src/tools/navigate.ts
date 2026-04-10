// mcp-server/src/tools/navigate.ts
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync } from 'fs';
import type { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';

const anthropic = new Anthropic();
const SCREENSHOTS_DIR = '.haunt-reports/screenshots';

export interface NavigateInput {
  session_id: string;
  think_aloud?: boolean;
}

export interface NavigateOutput {
  success: boolean;
  page_url: string;
  page_title: string;
  thought?: string;
  console_errors: string[];
  network_errors: string[];
  screenshot_path?: string;
  done: boolean;
  step: number;
}

interface HaikuAction {
  action: string;
  thought: string;
  done: boolean;
}

function parseHaikuResponse(raw: string): HaikuAction {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<HaikuAction>;
      return {
        action: parsed.action ?? '',
        thought: parsed.thought ?? '',
        done: parsed.done ?? false,
      };
    }
  } catch {
    // fall through
  }
  return { action: raw.slice(0, 200), thought: '', done: false };
}

export async function hauntNavigate(
  manager: SessionManager,
  input: NavigateInput,
): Promise<NavigateOutput> {
  const session = manager.get(input.session_id);
  const { stagehand, persona, messages } = session;
  const page = stagehand.page;

  // Step budget exhausted
  if (session.step_count >= session.max_steps) {
    return {
      success: true,
      page_url: page.url(),
      page_title: await page.title(),
      console_errors: [],
      network_errors: [],
      done: true,
      step: session.step_count,
    };
  }

  // Loop detection: same URL three times in a row
  const recent = session.pages_visited.slice(-3);
  if (recent.length === 3 && recent.every((u) => u === page.url())) {
    return {
      success: true,
      page_url: page.url(),
      page_title: await page.title(),
      thought: 'Navigation loop detected — ending session early',
      console_errors: [],
      network_errors: [],
      done: true,
      step: session.step_count,
    };
  }

  // Get page state via Stagehand observe (accessibility tree + fallback)
  let pageState: string;
  try {
    const observations = await page.observe({
      instruction: 'Describe what is visible and what actions are available to the user',
    });
    pageState = (observations as Array<{ description: string }>)
      .map((o) => o.description)
      .join('; ');
  } catch {
    pageState = `title: ${await page.title()}`;
  }

  // Drain captured errors for this step
  const stepConsoleErrors = session.console_errors.splice(0);
  const stepNetworkErrors = session.network_errors.splice(0);

  const userMessage = [
    `Current page: ${page.url()}`,
    `Title: ${await page.title()}`,
    `What you see: ${pageState}`,
    stepConsoleErrors.length > 0 ? `Console errors: ${stepConsoleErrors.join(' | ')}` : null,
    '',
    'Respond with JSON only:',
    '{ "action": "what you do next in natural language", "thought": "your internal reasoning as this persona", "done": false }',
    'Set done: true if your goal is complete or you are stuck.',
  ]
    .filter(Boolean)
    .join('\n');

  const updatedMessages: Anthropic.MessageParam[] = [
    ...messages,
    { role: 'user', content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 512,
    system: [
      persona.system_prompt,
      `Goal: ${persona.scenarios[0]?.goal ?? 'Explore the application'}`,
    ].join('\n\n'),
    messages: updatedMessages,
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const { action, thought, done } = parseHaikuResponse(rawText);

  session.messages = [
    ...updatedMessages,
    { role: 'assistant', content: rawText },
  ];
  session.step_count++;

  if (done || !action) {
    return {
      success: true,
      page_url: page.url(),
      page_title: await page.title(),
      thought: input.think_aloud ? thought : undefined,
      console_errors: stepConsoleErrors,
      network_errors: stepNetworkErrors,
      done: true,
      step: session.step_count,
    };
  }

  // Execute via Stagehand (handles hybrid accessibility tree + screenshot fallback internally)
  let screenshotPath: string | undefined;

  try {
    await page.act({ action });
  } catch (error) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    screenshotPath = `${session.id}-step-${session.step_count}.png`;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshotPath}` });

    const issue: Issue = {
      severity: 'major',
      category: 'ux',
      description: `Action failed: "${action}". ${error instanceof Error ? error.message : String(error)}`,
      page_url: page.url(),
      screenshot_path: screenshotPath,
      recommendation:
        'Ensure this interaction is reachable and clearly labeled for all users.',
    };
    session.issues.push(issue);
  }

  const currentUrl = page.url();
  session.pages_visited.push(currentUrl);

  return {
    success: true,
    page_url: currentUrl,
    page_title: await page.title(),
    thought: input.think_aloud ? thought : undefined,
    console_errors: stepConsoleErrors,
    network_errors: stepNetworkErrors,
    screenshot_path: screenshotPath,
    done: false,
    step: session.step_count,
  };
}
