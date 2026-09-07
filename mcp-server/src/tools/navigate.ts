// mcp-server/src/tools/navigate.ts
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { SCREENSHOTS_DIR, SESSION_TTL_MS } from '../constants.js';
import type { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';

export interface NavigateInput {
  session_id: string;
  // Natural language action decided by the orchestrator, e.g.:
  //   "click Login"  |  "fill Email with test@example.com"  |  "goto http://..."
  action: string;
  // Issues the orchestrator observed during this step
  issues?: Issue[];
}

export interface NavigateOutput {
  success: boolean;
  page_url: string;
  page_title: string;
  console_errors: string[];
  network_errors: string[];
  screenshot_path?: string;
  error?: string;
  step: number;
  steps_remaining: number;
}

// A fill/type/enter action targeting a password-like field carries the
// literal secret value in its own text — e.g. "fill hunter2 in Password".
// If that action fails, the raw action string must never end up verbatim
// in an Issue description (which flows straight into the written report),
// so the value is redacted before it's used for anything but the actual
// browser interaction.
const PASSWORD_FILL_RE =
  /^((?:fill|type|enter|input)\s+)(.+?)(\s+in(?:to)?\s+.*password.*)$/i;

function redactActionForReporting(action: string): string {
  const match = action.match(PASSWORD_FILL_RE);
  return match ? `${match[1]}[REDACTED]${match[3]}` : action;
}

async function executeAction(page: Page, action: string): Promise<void> {
  const trimmed = action.trim();

  // goto / navigate
  if (/^(goto|navigate to|go to)\s+/i.test(trimmed)) {
    const url = trimmed.replace(/^(goto|navigate to|go to)\s+/i, '').trim();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    return;
  }

  // press / key
  if (/^(press|hit|key)\s+/i.test(trimmed)) {
    const key = trimmed.replace(/^(press|hit|key)\s+/i, '').trim();
    await page.keyboard.press(key);
    return;
  }

  // fill/type/enter <text> in/into <field>
  const fillMatch = trimmed.match(
    /^(?:fill|type|enter|input)\s+(.+?)\s+in(?:to)?\s+(.+)/i,
  );
  if (fillMatch) {
    const text = fillMatch[1].replace(/^['"]|['"]$/g, '');
    const field = fillMatch[2].replace(/^['"]|['"]$/g, '');
    const loc = page
      .getByLabel(field, { exact: false })
      .or(page.getByPlaceholder(field, { exact: false }))
      .or(page.getByRole('textbox', { name: field }));
    await loc.first().fill(text);
    return;
  }

  // click / tap
  const clickTarget = trimmed.replace(/^(click|tap|select)\s+/i, '').trim();

  // Try role-based locators first (most reliable)
  for (const role of ['button', 'link', 'menuitem', 'tab', 'option'] as const) {
    try {
      await page
        .getByRole(role, { name: clickTarget, exact: false })
        .first()
        .click({ timeout: 3_000 });
      return;
    } catch {
      // try next
    }
  }

  // Fall back to text content
  await page
    .getByText(clickTarget, { exact: false })
    .first()
    .click({ timeout: 5_000 });
}

export async function hauntNavigate(
  manager: SessionManager,
  input: NavigateInput,
): Promise<NavigateOutput> {
  const session = manager.get(input.session_id);
  await manager.reapStale(SESSION_TTL_MS);

  if (session.step_count >= session.max_steps) {
    throw new Error(
      `Session ${session.id} hit its step limit (${session.max_steps}). Call haunt_end_session instead of navigating further.`,
    );
  }

  const { page } = session;

  // Record any issues the orchestrator flagged for this step
  if (input.issues?.length) {
    session.issues.push(...input.issues);
  }

  // Drain and clear accumulated errors — splice(0) returns all elements and empties the array
  const stepConsoleErrors = session.console_errors.splice(0);
  const stepNetworkErrors = session.network_errors.splice(0);

  session.step_count++;

  let screenshotPath: string | undefined;
  const blockedCountBefore = session.sandbox_blocked_requests.length;

  try {
    await executeAction(page, input.action);
  } catch (error) {
    const wasSandboxBlocked =
      session.sandbox_blocked_requests.length > blockedCountBefore;

    screenshotPath = `${session.id}-step-${session.step_count}.png`;
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshotPath}` });

    if (!wasSandboxBlocked) {
      const issue: Issue = {
        severity: 'major',
        category: 'ux',
        description: `Action failed: "${redactActionForReporting(input.action)}". ${error instanceof Error ? error.message : String(error)}`,
        page_url: page.url(),
        screenshot_path: screenshotPath,
        recommendation:
          'Ensure this interaction is reachable and clearly labeled.',
      };
      session.issues.push(issue);
    }

    return {
      success: false,
      page_url: page.url(),
      page_title: await page.title(),
      console_errors: stepConsoleErrors,
      network_errors: stepNetworkErrors,
      screenshot_path: screenshotPath,
      error: error instanceof Error ? error.message : String(error),
      step: session.step_count,
      steps_remaining: session.max_steps - session.step_count,
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
    steps_remaining: session.max_steps - session.step_count,
  };
}
