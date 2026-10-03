// mcp-server/src/gates/part-3/harness.ts
//
// What every part 3 gate test stands on: part 2's harness (a haunt session
// driven only through the MCP tools, its signals collected), opened on an
// evidence page, the ground truth's steps played and its issues filed, and
// a second, empty haunt server to replay bundles in.
//
// A result that carries no verification is an error here, never a pass: a
// gate test must not pass because the feature is missing.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { SessionManager } from '../../engine/session/manager.js';
import { EV_LOGIN } from '../../test-support/gauntlet/evidence-routes.js';
import {
  type EvidenceClaim,
  type EvidenceStep,
  type EvidenceTruth,
  loadEvidenceTruth,
} from '../../test-support/gauntlet/evidence-truth.js';
import type {
  EvidencePage,
  Variant,
} from '../../test-support/gauntlet/server.js';
import {
  type HauntClient,
  connectInMemory,
} from '../../test-support/mcp-client.js';
import type { Signal } from '../part-2/contract.js';
import {
  type SignalContext,
  SignalSession,
  pathOf,
  useSignals,
} from '../part-2/harness.js';
import type {
  ClaimedIssue,
  EndSessionEvidenceOutput,
  ReplayInput,
  ReplayOutput,
  VerifiedIssue,
} from './contract.js';
import { PASSING } from './status.js';

export const EVIDENCE = loadEvidenceTruth();

// Registers a gate test. `id` is its number in the spec's gate (E2.1),
// `requirements` the requirement ids it proves. Until the id is listed in
// status.ts the test is an expected failure.
export function gate(
  id: string,
  requirements: string,
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 120_000,
): void {
  const run = PASSING.has(id) ? it : it.fails;
  run(`${id} [${requirements}] ${name}`, fn, timeoutMs);
}

// Whether a signal is the one a claim describes.
export function fitsClaim(
  signal: Signal,
  claim: Extract<EvidenceClaim, { signal: unknown }>['signal'],
): boolean {
  if (signal.kind !== claim.kind) return false;
  const have = signal as unknown as Record<string, unknown>;
  if (claim.path !== undefined) {
    const url = have.request_url as string | undefined;
    if (!url || pathOf(url) !== claim.path) return false;
  }
  if (claim.status !== undefined && have.status !== claim.status) return false;
  if (
    claim.message_contains !== undefined &&
    !signal.message.includes(claim.message_contains)
  ) {
    return false;
  }
  return true;
}

// The issue a tester files for a claim, given the session's signals and the
// last step played. On a clean variant a signal claim finds no signal: it is
// filed naming one that does not exist, as a model that imagined it would.
export function issueFor(
  claim: EvidenceClaim,
  signals: Signal[],
  lastStep: number,
  pageUrl: string,
): ClaimedIssue {
  const base = {
    severity: 'major' as const,
    category: 'ux' as const,
    description: `Gate claim ${JSON.stringify(claim)}`,
    page_url: pageUrl,
    recommendation: 'Fix it',
  };
  if ('signal' in claim) {
    const found = signals.find((s) => fitsClaim(s, claim.signal));
    return { ...base, signal: found?.id ?? 's999' };
  }
  return { ...base, observed: { ...claim.observed, step: lastStep } };
}

function verified(what: string, value: unknown): EndSessionEvidenceOutput {
  const output = value as Partial<EndSessionEvidenceOutput>;
  if (!Array.isArray(output?.issues_found) || !Array.isArray(output.rejected)) {
    throw new Error(`${what} returned no verified issues`);
  }
  for (const issue of [...output.issues_found, ...output.rejected]) {
    if (!issue.verification)
      throw new Error(`${what}: an issue has no verification`);
  }
  return output as EndSessionEvidenceOutput;
}

// A session on an evidence page, its steps played.
export class EvidenceSession {
  // The step number of each step of the ground truth, repeats included.
  readonly played: number[] = [];
  ended?: EndSessionEvidenceOutput;

  constructor(
    readonly ctx: EvidenceContext,
    readonly s: SignalSession,
    readonly page: EvidencePage,
    readonly variant: Variant,
    readonly url: string,
  ) {}

  get truth(): EvidenceTruth {
    return EVIDENCE[this.page];
  }

  // Plays steps of the ground truth, by reference, as a tester would.
  async play(steps: EvidenceStep[] = this.truth.steps): Promise<void> {
    for (const step of steps) {
      for (let i = 0; i < (step.repeat ?? 1); i++) {
        const ref = await this.s.s.ref(step.target);
        const action =
          step.type === 'click'
            ? { type: 'click' as const, ref }
            : step.type === 'select'
              ? { type: 'select' as const, ref, values: step.values ?? [] }
              : {
                  type: 'fill' as const,
                  ref,
                  text: step.secret ? EV_LOGIN[step.secret] : (step.text ?? ''),
                };
        const result = await this.s.act(action);
        expect(result.results[0]?.ok, `${step.type} ${step.target}`).toBe(true);
        this.played.push(result.step);
      }
    }
    if (this.truth.wait_ms) await this.s.wait(this.truth.wait_ms + 500);
  }

  // A screenshot of the page through haunt_capture_state, the focus on
  // `focus` first so that two shots differ only by what the page shows.
  async screenshot(focus: string): Promise<Buffer> {
    await this.s.act({
      type: 'press',
      ref: await this.s.s.ref(focus),
      keys: 'Shift',
    });
    const shot = await this.ctx.haunt.call<{ screenshot_path?: string }>(
      'haunt_capture_state',
      { session_id: this.s.s.id, include_screenshot: true },
    );
    if (shot.isError || !shot.data.screenshot_path) {
      throw new Error(`no screenshot: ${shot.text}`);
    }
    return readFileSync(
      join('.haunt-reports/screenshots', shot.data.screenshot_path),
    );
  }

  get lastStep(): number {
    return this.played[this.played.length - 1] ?? 0;
  }

  // The ground truth's issues, as filed at the end of this session.
  issues(): ClaimedIssue[] {
    return this.truth.claims.map((claim) =>
      issueFor(claim, this.s.all(), this.lastStep, this.url),
    );
  }

  // Ends the session with these issues; returns what verification made of
  // them.
  async end(
    issues: ClaimedIssue[] = this.issues(),
  ): Promise<EndSessionEvidenceOutput> {
    const result = await this.ctx.haunt.call('haunt_end_session', {
      session_id: this.s.s.id,
      issues,
    });
    if (result.isError) throw new Error(result.text);
    this.ended = verified('haunt_end_session', result.data);
    return this.ended;
  }

  // Every issue of the ended session, rejected or not.
  get all(): VerifiedIssue[] {
    if (!this.ended) throw new Error('the session has not ended');
    return [...this.ended.issues_found, ...this.ended.rejected];
  }
}

export interface EvidenceContext extends SignalContext {
  // Opens a session on an evidence page. ev-flaky gets a run of its own.
  ev(
    page: EvidencePage,
    variant?: Variant,
    spawn?: Record<string, unknown>,
  ): Promise<EvidenceSession>;
  // Replays a bundle in a haunt server that has seen nothing of this file's
  // sessions.
  replay(input: ReplayInput): Promise<ReplayOutput>;
}

let runs = 0;

// Call once at the top of a gate file's describe block.
export function useEvidence(): EvidenceContext {
  const context = useSignals() as EvidenceContext;
  let replayer: HauntClient | undefined;

  context.ev = async (page, variant = 'buggy', spawn = {}) => {
    const truth = EVIDENCE[page];
    const query = [
      `variant=${variant}`,
      truth.query?.replace('run=gauntlet', `run=gate-${process.pid}-${++runs}`),
    ]
      .filter(Boolean)
      .join('&');
    const url = context.gauntlet.url(page, query);
    const opened = await context.openUrl(url, {
      timeout: 400,
      replay_budget_ms: 120_000,
      ...spawn,
    });
    const spawned = JSON.parse(
      context.transcript[context.transcript.length - 1],
    );
    return new EvidenceSession(
      context,
      new SignalSession(opened, spawned.signals ?? []),
      page,
      variant,
      url,
    );
  };

  context.replay = async (input) => {
    replayer ??= await connectInMemory(new SessionManager());
    const result = await replayer.call<ReplayOutput>('haunt_replay', {
      ...input,
    });
    if (result.isError) throw new Error(result.text);
    return result.data;
  };

  return context;
}

// ---------------------------------------------------------------------------
// Files written
// ---------------------------------------------------------------------------

// Every file under a directory, recursively.
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

export function sizeOf(dir: string): number {
  return filesUnder(dir).reduce((sum, file) => sum + statSync(file).size, 0);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf-8')) as T;
}

// The entries of a zip archive (a trace), uncompressed, read with nothing
// but zlib: the gate searches inside them, on any system.
export function zipEntries(path: string): Map<string, Buffer> {
  const zip = readFileSync(path);
  // The end of central directory record, searched from the end.
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error(`${path} is not a zip archive`);
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf-8', at + 46, at + 46 + nameLength);
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    entries.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
