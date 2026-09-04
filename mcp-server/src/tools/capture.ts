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
  accessibility_tree_error?: string;
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

  // ARIA snapshot of the whole page — no AI needed. page.accessibility was removed
  // from playwright-core; locator.ariaSnapshot() is the current replacement.
  let accessibility_tree: string | undefined;
  let accessibility_tree_error: string | undefined;
  try {
    accessibility_tree = (await page.locator('body').ariaSnapshot()).slice(0, 4_000);
  } catch (error) {
    accessibility_tree_error = error instanceof Error ? error.message : String(error);
  }

  // dom_snapshot is capped at 5000 chars to avoid token overflow
  let dom_snapshot: string | undefined;
  if (input.include_dom) {
    dom_snapshot = (await page.content()).slice(0, 5_000);
  }

  return { url, title, accessibility_tree, accessibility_tree_error, dom_snapshot, screenshot_path };
}
