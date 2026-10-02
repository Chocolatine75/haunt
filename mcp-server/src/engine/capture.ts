// mcp-server/src/engine/capture.ts
import { mkdirSync } from 'node:fs';
import type { Snapshot } from '../gates/part-1/contract.js';
import { SCREENSHOTS_DIR, SESSION_TTL_MS } from './constants.js';
import type { SessionManager } from './session/manager.js';
import { type SnapshotOptions, takeSnapshot } from './snapshot/snapshot.js';

export interface CaptureInput extends SnapshotOptions {
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

export function hauntCaptureState(
  manager: SessionManager,
  input: CaptureInput & { format: 'text' | 'json' },
): Promise<Snapshot>;
export function hauntCaptureState(
  manager: SessionManager,
  input: CaptureInput & { format?: undefined },
): Promise<CaptureOutput>;
export function hauntCaptureState(
  manager: SessionManager,
  input: CaptureInput,
): Promise<CaptureOutput | Snapshot>;
export async function hauntCaptureState(
  manager: SessionManager,
  input: CaptureInput,
): Promise<CaptureOutput | Snapshot> {
  const session = manager.get(input.session_id);
  await manager.reapStale(SESSION_TTL_MS);

  // Asking for a format selects the reference-based snapshot. Without one the
  // previous output is returned, until every caller has moved over.
  if (input.format) {
    const { session_id, include_screenshot, include_dom, ...options } = input;
    return takeSnapshot(session, options);
  }
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
    accessibility_tree = (await page.locator('body').ariaSnapshot()).slice(
      0,
      4_000,
    );
  } catch (error) {
    accessibility_tree_error =
      error instanceof Error ? error.message : String(error);
  }

  // dom_snapshot is capped at 5000 chars to avoid token overflow
  let dom_snapshot: string | undefined;
  if (input.include_dom) {
    dom_snapshot = (await page.content()).slice(0, 5_000);
  }

  return {
    url,
    title,
    accessibility_tree,
    accessibility_tree_error,
    dom_snapshot,
    screenshot_path,
  };
}
