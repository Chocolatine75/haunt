// S6 — confidentiality (R-S18).
//
// sig-secrets puts what was typed into its password field in a query
// string, a path, an error message, the name of a function on the stack, a
// console line and a rejection. signals.test.ts shows the browser reports
// all six with the secret in them.
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect } from 'vitest';
import {
  TOURED,
  TOUR_SECRET,
  expectExactly,
  expectedOfTour,
  gate,
  tour,
  useSignals,
  useTours,
} from './harness.js';

// The secret as typed, and as a URL spells it.
const FORMS = [
  TOUR_SECRET,
  encodeURIComponent(TOUR_SECRET),
  encodeURI(TOUR_SECRET),
  TOUR_SECRET.replaceAll(' ', '+'),
];

describe('S6 confidentiality', () => {
  const ctx = useSignals();
  const tourOf = useTours(ctx);

  describe('S6.1 no secret in a signal', () => {
    gate(
      'S6.1',
      'R-S18',
      'a password typed on sig-secrets appears in no signal, no tool result, no report and no file',
      async () => {
        const startedAt = Date.now();
        const before = ctx.gauntlet.requests.base.length;
        ctx.transcript.length = 0;

        const toured = await tour(ctx, 'sig-secrets', 'buggy');
        // The page had it, and sent it: the failures are real.
        expect(ctx.gauntlet.requests.base.slice(before)).toContain(
          `GET /sig/api/reset/${encodeURIComponent(TOUR_SECRET)}`,
        );
        expectExactly(toured.signals, expectedOfTour(toured.truth), 'tour');

        const report = await ctx.haunt.call<{ report_path: string }>(
          'haunt_generate_report',
          {
            target_url: ctx.gauntlet.baseUrl,
            personas: ['gate-s6-1'],
            sessions: [
              {
                area: '/sig-secrets',
                persona: 'gate',
                overall_impression: 'done',
                issues: [],
                signals: toured.signals,
              },
            ],
          },
        );
        expect(report.isError).toBe(false);

        const everything = ctx.transcript.join('\n');
        expect(everything.length).toBeGreaterThan(1_000);
        for (const form of FORMS) {
          expect(everything.includes(form), `"${form}" in a tool result`).toBe(
            false,
          );
        }

        // Nor is it in anything written to disk during the test.
        const reports = resolve('.haunt-reports');
        const written: string[] = [];
        if (existsSync(reports)) {
          for (const entry of readdirSync(reports)) {
            const path = join(reports, entry);
            if (!statSync(path).isFile() || statSync(path).mtimeMs < startedAt)
              continue;
            written.push(path);
            const content = readFileSync(path, 'utf-8');
            for (const form of FORMS) {
              expect(content.includes(form), `"${form}" in ${entry}`).toBe(
                false,
              );
            }
          }
        }
        expect(written).toContain(resolve(report.data.report_path));
        for (const path of written) rmSync(path, { force: true });
      },
      60_000,
    );

    gate(
      'S6.1',
      'R-S18',
      'what replaces the secret still says what failed',
      async () => {
        const toured = await tourOf('sig-secrets');
        const at = (control: string) =>
          toured.signals.find((s) => s.step === toured.steps.get(control));
        // The rest of each message survives the redaction.
        expect(at('in-message')?.message).toContain('is too weak');
        expect(at('in-console')?.message).toContain(
          'login failed with password',
        );
        expect(at('in-rejection')?.message).toContain('was refused');
        const reset = at('in-path');
        expect(reset?.kind === 'http_error' && reset.request_url).toMatch(
          /\/sig\/api\/reset\/[^/?]+$/,
        );
      },
      60_000,
    );
  });

  describe('S6.2 no query string', () => {
    gate(
      'S6.2',
      'R-S18',
      'no signal of any page carries a query string, in a URL, a message or a stack',
      async () => {
        for (const page of TOURED) {
          const { signals } = await tourOf(page);
          expect(signals.length, page).toBeGreaterThan(0);
          for (const signal of signals) {
            // Every page here is served with ?variant=buggy, and so are its
            // requests and the scripts its stacks point into.
            expect(JSON.stringify(signal), signal.id).not.toMatch(
              /\?[\w-]+=|variant=/,
            );
          }
        }
      },
      240_000,
    );
  });
});
