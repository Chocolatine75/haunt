// mcp-server/src/screenshots.ts
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENSHOTS_DIR } from './constants.js';

// Removes files older than maxAgeMs from dir. Best-effort: a missing directory or
// a file that vanishes mid-sweep (e.g. a concurrent haunt process) is not an error.
export function purgeOldScreenshots(
  maxAgeMs: number,
  dir: string = SCREENSHOTS_DIR,
): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const now = Date.now();
  const removed: string[] = [];

  for (const entry of entries) {
    const filePath = join(dir, entry);
    try {
      const stat = statSync(filePath);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        unlinkSync(filePath);
        removed.push(entry);
      }
    } catch {
      // Already gone, or not a file we can stat/remove — skip it.
    }
  }

  return removed;
}
