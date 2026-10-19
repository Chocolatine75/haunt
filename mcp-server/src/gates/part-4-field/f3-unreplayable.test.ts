// What nine more applications showed (docs/v3/part-4-field.md), C: an issue
// whose steps no replay could play has not been disproved. It is left for a
// person to check, where it used to be rejected and left out of the report.
import { rmSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useSignals } from '../part-2/harness.js';
import { PASSING } from './status.js';

function gate(
  id: string,
  requirements: string,
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 240_000,
): void {
  const run = PASSING.has(id) ? it : it.fails;
  run(`${id} [${requirements}] ${name}`, fn, timeoutMs);
}

// Cards named at random on each load, as CATTest 30's are: what a session
// pressed is not on the page a replay opens. "Help" is there every time.
const PAGE = `<!doctype html><html lang="en"><title>Secrets</title>
  <h1>Secrets</h1>
  <p><button id="help" type="button">Help</button></p>
  <div id="cards"></div>
  <p id="out" role="status"></p>
  <script>
    const out = document.getElementById('out');
    document.getElementById('help').addEventListener('click', () => {
      out.textContent = 'Pick a card to read it.';
    });
    for (let i = 0; i < 3; i++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.textContent = 'Card ' + Math.random().toString(36).slice(2, 10);
      card.addEventListener('click', () => { out.textContent = 'Burned, and blank.'; });
      document.getElementById('cards').append(card);
    }
  </script></html>`;

interface Verified {
  description: string;
  verification: { status: string; reason?: string; failed_step?: number };
}

describe('F3 not replayable is not rejected', () => {
  const ctx = useSignals();
  const written: string[] = [];
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });
  afterEach(() => {
    for (const path of written.splice(0)) {
      rmSync(path, { force: true, recursive: true });
    }
  });

  const issue = (description: string, text: string) => ({
    severity: 'major',
    category: 'ux',
    description,
    page_url: url,
    recommendation: 'Show the secret before it burns.',
    observed: { text_present: text },
  });

  gate(
    'F3.1',
    'R-F5',
    'an issue no replay could play is unchecked, with why, and listed for a person; one whose steps replay and whose claim is false is rejected',
    async () => {
      const session = await ctx.openUrl(url, { replay_budget_ms: 120_000 });
      const { elements } = await session.snapshot();
      const card = elements.find((e) => e.name.startsWith('Card '));
      const help = elements.find((e) => e.name === 'Help');
      if (!card || !help) throw new Error('the page has no card or no help');

      // True in the session, on a card no replay will find.
      await session.ok({ type: 'click', ref: card.ref });
      const ended = await ctx.haunt.call<{
        session_id: string;
        issues_found: Verified[];
        rejected: Verified[];
      }>('haunt_end_session', {
        session_id: session.id,
        issues: [
          issue(
            'The dialog is blank once the secret has burned.',
            'Burned, and blank.',
          ),
        ],
      });
      if (ended.isError) throw new Error(ended.text);
      expect(
        ended.data.issues_found.map((i) => [
          i.description,
          i.verification.status,
          i.verification.reason,
          i.verification.failed_step,
        ]),
      ).toEqual([
        [
          'The dialog is blank once the secret has burned.',
          'unchecked',
          'not_replayable',
          1,
        ],
      ]);
      expect(ended.data.rejected).toEqual([]);

      // On the same page, steps every replay can play and a claim that is
      // false: rejected, as before.
      const other = await ctx.openUrl(url, { replay_budget_ms: 120_000 });
      await other.ok({ type: 'click', ref: help.ref });
      const refused = await ctx.haunt.call<{
        issues_found: Verified[];
        rejected: Verified[];
      }>('haunt_end_session', {
        session_id: other.id,
        issues: [
          issue('Help says the account was deleted.', 'Account deleted'),
        ],
      });
      if (refused.isError) throw new Error(refused.text);
      expect(refused.data.issues_found).toEqual([]);
      expect(
        refused.data.rejected.map((i) => [
          i.description,
          i.verification.status,
          i.verification.reason,
        ]),
      ).toEqual([
        ['Help says the account was deleted.', 'rejected', 'not_reproduced'],
      ]);

      const report = await ctx.haunt.call<{
        report_path: string;
        markdown: string;
        issue_counts?: { total: number };
      }>('haunt_generate_report', {
        target_url: url,
        date: '2026-05-07',
        sessions: [
          {
            session_id: ended.data.session_id,
            area: '/',
            overall_impression: 'done',
          },
        ],
      });
      if (report.isError) throw new Error(report.text);
      written.push(
        report.data.report_path,
        report.data.report_path.replace(/\.md$/, '.json'),
      );
      const byHand = report.data.markdown.split('## To check by hand')[1] ?? '';
      expect(byHand).toContain(
        'The dialog is blank once the secret has burned.',
      );
      expect(report.data.markdown).toMatch(/^issues:\n {2}total: 0$/m);
    },
  );
});
