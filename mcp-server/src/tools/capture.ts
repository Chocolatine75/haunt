// mcp-server/src/tools/capture.ts
import { mkdirSync } from 'node:fs';
import type { SessionManager } from '../session/manager.js';
import { SCREENSHOTS_DIR } from '../constants.js';

export interface CaptureInput {
  session_id: string;
  include_screenshot?: boolean;
  include_dom?: boolean;
}

export interface CaptureOutput {
  url: string;
  title: string;
  accessibility_tree?: string;
  dom_snapshot?: string;
  screenshot_path?: string;
}

export async function hauntCaptureState(
  manager: SessionManager,
  input: CaptureInput,
): Promise<CaptureOutput> {
  const session = manager.get(input.session_id);
  const { page } = session;

  const url = page.url();
  const title = await page.title();

  let screenshot_path: string | undefined;
  if (input.include_screenshot ?? true) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    screenshot_path = `${session.id}-capture-${Date.now()}.png`;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshot_path}` });
  }

  // Playwright's built-in accessibility snapshot — no AI needed
  let accessibility_tree: string | undefined;
  try {
    const snapshot = await page.accessibility.snapshot();
    accessibility_tree = JSON.stringify(snapshot, null, 2).slice(0, 4_000);
  } catch {
    accessibility_tree = undefined;
  }

  // dom_snapshot is capped at 5000 chars to avoid token overflow
  let dom_snapshot: string | undefined;
  if (input.include_dom) {
    dom_snapshot = (await page.content()).slice(0, 5_000);
  }

  return { url, title, accessibility_tree, dom_snapshot, screenshot_path };
}
