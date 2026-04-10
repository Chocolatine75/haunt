// mcp-server/src/tools/capture.ts
import { mkdirSync } from 'fs';
import type { SessionManager } from '../session/manager.js';

const SCREENSHOTS_DIR = '.haunt-reports/screenshots';

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
  const page = session.stagehand.page;

  const url = page.url();
  const title = await page.title();

  let screenshot_path: string | undefined;
  if (input.include_screenshot ?? true) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    screenshot_path = `${session.id}-capture-${Date.now()}.png`;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${screenshot_path}` });
  }

  let accessibility_tree: string | undefined;
  try {
    const observations = await page.observe({
      instruction: 'List all interactive elements and their accessible labels',
    });
    accessibility_tree = (observations as Array<{ description: string }>)
      .map((o) => o.description)
      .join('\n');
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
