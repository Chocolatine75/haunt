// mcp-server/src/engine/evidence/screenshot.ts
//
// Screenshots with every credential field masked (R-E15): a typed email is
// as readable in pixels as in text, and a password field's length is a
// clue. The same rule as the snapshot's "(filled)".
import type { Locator, Page } from 'playwright';
import { credentialField } from '../act/page-fns.js';
import { sabotaged } from '../sabotage.js';

async function credentialFields(page: Page): Promise<Locator[]> {
  const found: Locator[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const inputs = frame.locator('input');
    const count = await inputs.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (await input.evaluate(credentialField).catch(() => false)) {
        found.push(input);
      }
    }
  }
  return found;
}

export async function maskedScreenshot(
  page: Page,
  path?: string,
): Promise<Buffer> {
  const mask = sabotaged('evidence_screenshots_unmasked')
    ? []
    : await credentialFields(page);
  return page.screenshot({ path, mask, maskColor: '#888888' });
}
