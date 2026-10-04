// mcp-server/src/engine/capture.ts
import { mkdirSync } from 'node:fs';
import type { Snapshot } from '../gates/part-1/contract.js';
import type { Signal } from '../gates/part-2/contract.js';
import { SCREENSHOTS_DIR, SESSION_TTL_MS } from './constants.js';
import { maskedScreenshot } from './evidence/screenshot.js';
import type { SessionManager } from './session/manager.js';
import { auditNow } from './signals/audit.js';
import { type SnapshotOptions, takeSnapshot } from './snapshot/snapshot.js';

export interface CaptureInput extends SnapshotOptions {
  session_id: string;
  include_screenshot?: boolean;
  // Also list every signal raised so far on the current page.
  signals?: boolean;
  // Audit the page as it is now (R-S15). Implies `signals`, with this
  // audit's findings in place of earlier ones.
  audit?: boolean;
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

  const { session_id, include_screenshot, signals, audit, ...options } = input;
  const output: CaptureOutput = await takeSnapshot(session, options);
  if (audit) {
    const { collector } = session;
    const found = await auditNow(session, collector.currentStep);
    output.signals = [
      ...collector
        .onPage(session.page.url())
        .filter((signal) => signal.kind !== 'a11y'),
      ...collector.handOverNow(found),
    ];
  } else if (signals) {
    output.signals = session.collector.onPage(session.page.url());
  }

  // A page frozen by a dialog cannot be photographed.
  if (include_screenshot && !session.runtime.dialog) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    output.screenshot_path = `${session.id}-capture-${Date.now()}.png`;
    // Credential fields masked, as in a bundle (R-E15).
    await maskedScreenshot(
      session.page,
      `${SCREENSHOTS_DIR}/${output.screenshot_path}`,
    );
  }
  return output;
}
