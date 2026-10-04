// mcp-server/src/test-support/gauntlet/evidence-truth.ts
//
// What a correct tester files on each evidence page, and what verification
// must make of it (evidence-truth.json). It describes the buggy variant; on
// the clean variant the same steps lead to nothing, and the same issue filed
// anyway must be rejected. evidence.test.ts checks this against what the
// browser really does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EvidencePage } from './server.js';

// One step of the scripted session, on the control carrying data-g=target.
export interface EvidenceStep {
  type: 'click' | 'fill' | 'select';
  target: string;
  // data-frame of the frame the control is in.
  frame?: string;
  text?: string;
  values?: string[];
  // The text is the credential of that name (EV_LOGIN in
  // evidence-routes.ts), typed into a credential field.
  secret?: 'email' | 'password';
  // The same step this many times in a row.
  repeat?: number;
}

// The claim of the issue a tester files (R-E1).
export type EvidenceClaim =
  | {
      signal: {
        kind: string;
        path?: string;
        status?: number;
        message_contains?: string;
      };
    }
  | { observed: { text_absent?: string; text_present?: string } };

export interface EvidenceTruth {
  // Query to open the page with, beyond the variant (ev-flaky's run).
  query?: string;
  steps: EvidenceStep[];
  // One issue per claim, each about the step that caused it.
  claims: EvidenceClaim[];
  // What verification must conclude on the buggy variant.
  status: 'confirmed' | 'flaky';
  // For a flaky one: reproduced / attempts over its replays.
  rate?: number;
  // How long after the last step the failure shows.
  wait_ms?: number;
}

export function loadEvidenceTruth(): Record<EvidencePage, EvidenceTruth> {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./evidence-truth.json', import.meta.url)),
      'utf-8',
    ),
  );
}
