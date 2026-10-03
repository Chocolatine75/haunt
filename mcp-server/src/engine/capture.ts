// mcp-server/src/engine/capture.ts
import { mkdirSync } from 'node:fs';
import type { Snapshot } from '../gates/part-1/contract.js';
import type { Signal } from '../gates/part-2/contract.js';
import { SCREENSHOTS_DIR, SESSION_TTL_MS } from './constants.js';
import type { SessionManager } from './session/manager.js';
import { type SnapshotOptions, takeSnapshot } from './snapshot/snapshot.js';

export interface CaptureInput extends SnapshotOptions {
  session_id: string;
  include_screenshot?: boolean;
  // Also list every signal raised so far on the current page.
  signals?: boolean;
}

export type CaptureOutput = Snapshot & {
  screenshot_path?: string;
  signals?: Signal[];
};

// The page as a tester reads it: every actionable element with its
// reference, in reading order with the surrounding text (see
// snapshot/snapshot.ts). A screenshot is taken only when asked for.
export async function hauntCaptureState(
  manager: SessionManager,
  input: CaptureInput,
): Promise<CaptureOutput> {
  const session = manager.get(input.session_id);
  await manager.reapStale(SESSION_TTL_MS);

  const { session_id, include_screenshot, signals, ...options } = input;
  const output: CaptureOutput = await takeSnapshot(session, options);
  if (signals) output.signals = session.collector.onPage(session.page.url());

  // A page frozen by a dialog cannot be photographed.
  if (include_screenshot && !session.runtime.dialog) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    output.screenshot_path = `${session.id}-capture-${Date.now()}.png`;
    await session.page.screenshot({
      path: `${SCREENSHOTS_DIR}/${output.screenshot_path}`,
    });
  }
  return output;
}
