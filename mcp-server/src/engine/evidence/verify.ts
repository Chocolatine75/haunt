// mcp-server/src/engine/evidence/verify.ts
//
// Before a session's issues leave the engine, each is replayed in a fresh
// browser (R-E8 … R-E11) and the replay that reproduced it is kept as its
// evidence bundle (R-E13, R-E16).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Signal } from '../../gates/part-2/contract.js';
import {
  BUNDLE_CAP_BYTES,
  type CappedVerification,
  type ClaimedIssue,
  type Observation,
  type SignalVerifications,
  type StepsFile,
  type Verification,
  type VerifiedIssue,
} from '../../gates/part-3/contract.js';
import type { Expectation, TesterIssue } from '../../gates/part-4/contract.js';
import { REPORTS_DIR } from '../constants.js';
import { sabotaged } from '../sabotage.js';
import type { HauntSession } from '../types.js';
import { locatorOf } from './recording.js';
import { type ReplayRun, replay } from './replay.js';

export const EVIDENCE_DIR = `${REPORTS_DIR}/evidence`;

// Replays a claim gets: three to confirm it, up to ten to measure a rate.
const CONFIRM = 3;
const MEASURE = 10;
// Browsers replaying at once.
const PARALLEL = 3;

type Claim = StepsFile['claim'];

export interface VerifiedSession {
  issues_found: VerifiedIssue[];
  rejected: VerifiedIssue[];
  signal_verification: SignalVerifications;
}

function stepsFileOf(session: HauntSession, claim: Claim): StepsFile {
  const { recording } = session;
  return {
    version: 1,
    start_url: recording.start_url,
    viewport: recording.viewport,
    spawn: recording.spawn,
    steps: recording.steps.filter((s) => s.step <= claim.step),
    claim,
    secrets: [...recording.secrets.values()],
  };
}

function sizeOf(dir: string): number {
  return readdirSync(dir).reduce(
    (sum, file) => sum + statSync(join(dir, file)).size,
    0,
  );
}

// Writes a bundle from the replay that reproduced the claim, and keeps it
// under the session's cap: the trace goes first, then the screenshot
// (R-E16).
function writeBundle(
  dir: string,
  file: StepsFile,
  run: ReplayRun,
  verification: Verification,
  cap: number,
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'steps.json'), JSON.stringify(file, null, 2));
  const evidence = run.evidence;
  if (evidence) {
    writeFileSync(join(dir, 'screenshot.png'), evidence.screenshot);
    writeFileSync(
      join(dir, 'network.json'),
      JSON.stringify(evidence.network, null, 2),
    );
    if (evidence.trace && existsSync(evidence.trace)) {
      // Copied, not renamed: the scratch directory is under the system's
      // temporary one, which is often another volume (C: and D: on GitHub's
      // Windows runners, a tmpfs /tmp on Linux), and a rename across volumes
      // fails with EXDEV. The scratch directory is removed with the rest.
      copyFileSync(evidence.trace, join(dir, 'trace.zip'));
    }
  }
  const signal =
    run.signal ?? ('signal' in file.claim ? file.claim.signal : undefined);
  if (signal)
    writeFileSync(join(dir, 'signal.json'), JSON.stringify(signal, null, 2));

  const written: CappedVerification = { ...verification, bundle: dir };
  const write = () =>
    writeFileSync(
      join(dir, 'verification.json'),
      JSON.stringify(written, null, 2),
    );
  write();
  if (sabotaged('evidence_cap_ignored')) return;
  for (const [file, what] of [
    ['trace.zip', 'trace'],
    ['screenshot.png', 'screenshot'],
  ] as const) {
    if (sizeOf(dir) < cap) return;
    rmSync(join(dir, file), { force: true });
    written.dropped = [...(written.dropped ?? []), what];
    write();
  }
}

// Replays a claim and concludes. `forSignal`: a signal the engine saw
// happen is never dropped, even if no replay reproduces it (R-E10).
async function verifyClaim(
  session: HauntSession,
  claim: Claim,
  deadline: number,
  dir: string,
  forSignal: boolean,
): Promise<Verification> {
  const file = stepsFileOf(session, claim);
  const secrets = Object.fromEntries(
    [...session.recording.secrets].map(([value, placeholder]) => [
      placeholder,
      value,
    ]),
  );
  // Sabotage only: replays given what the session's own browser holds.
  const cookies = sabotaged('evidence_same_session')
    ? await session.page
        .context()
        .cookies()
        .catch(() => [])
    : session.evidence.cookies;
  const runs: ReplayRun[] = [];
  const scratch: string[] = [];
  const batch = async (count: number) => {
    const started = Array.from({ length: count }, () => {
      const evidenceDir = mkdtempSync(join(tmpdir(), 'haunt-replay-'));
      scratch.push(evidenceDir);
      return replay(file, {
        secrets,
        cookies,
        known: session.evidence.secrets,
        evidenceDir,
      }).catch(
        (): ReplayRun => ({ outcome: 'not_replayable', reproduced: false }),
      );
    });
    const done = await Promise.all(started);
    // What finished past the budget does not count: the budget bounds how
    // long verification holds the session's end (R-E11).
    if (Date.now() > deadline) return false;
    runs.push(...done);
    return true;
  };

  try {
    let unverified = false;
    const confirm = sabotaged('evidence_one_replay') ? 1 : CONFIRM;
    for (let done = 0; done < confirm && !unverified; done += PARALLEL) {
      unverified =
        Date.now() >= deadline ||
        !(await batch(Math.min(PARALLEL, confirm - done)));
    }
    const allReproduced = () => runs.every((r) => r.reproduced);
    while (!unverified && !allReproduced() && runs.length < MEASURE) {
      unverified =
        Date.now() >= deadline ||
        !(await batch(Math.min(PARALLEL, MEASURE - runs.length)));
    }
    const reproduced = runs.filter((r) => r.reproduced).length;
    const attempts = runs.length;
    const rate = attempts === 0 ? 0 : reproduced / attempts;
    const base = { attempts, reproduced, rate };

    let verification: Verification;
    if (unverified) {
      verification = { status: 'unverified', ...base };
    } else if (reproduced === attempts) {
      verification = { status: 'confirmed', ...base, rate: 1 };
    } else if (reproduced > 0 || forSignal) {
      verification = {
        status: sabotaged('evidence_flaky_as_confirmed')
          ? 'confirmed'
          : 'flaky',
        ...base,
      };
    } else {
      const stuck = runs.find((r) => r.outcome === 'not_replayable');
      verification = {
        status: 'rejected',
        ...base,
        reason: runs.every((r) => r.outcome === 'not_replayable')
          ? 'not_replayable'
          : 'not_reproduced',
        ...(stuck?.failed_step !== undefined
          ? { failed_step: stuck.failed_step }
          : {}),
      };
    }
    const proof = runs.find((r) => r.reproduced);
    if (
      proof &&
      (verification.status === 'confirmed' || verification.status === 'flaky')
    ) {
      writeBundle(
        dir,
        file,
        proof,
        verification,
        session.evidence.bundle_cap_bytes,
      );
      verification.bundle = dir;
    }
    return verification;
  } finally {
    for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
  }
}

const rejected = (reason: Verification['reason']): Verification => ({
  status: 'rejected',
  attempts: 0,
  reproduced: 0,
  rate: 0,
  reason,
});

// Verifies every issue of a session and every signal no issue names.
export async function verifySession(
  session: HauntSession,
  issues: TesterIssue[],
  signals: Signal[],
): Promise<VerifiedSession> {
  const deadline = Date.now() + session.evidence.replay_budget_ms;
  const root = join(EVIDENCE_DIR, session.id);
  const out: VerifiedSession = {
    issues_found: [],
    rejected: [],
    signal_verification: {},
  };
  const named = new Set<string>();

  for (const [i, issue] of issues.entries()) {
    let verification: Verification;
    const signal = issue.signal
      ? signals.find((s) => s.id === issue.signal)
      : undefined;
    // A case the engine gave a verdict to: its expectation, as checked then
    // (R-T10). One the tester closed has nothing a replay can check.
    const ofCase =
      issue.case !== undefined
        ? session.plan.claims.get(issue.case)
        : undefined;
    const closedByTester =
      issue.case !== undefined &&
      session.plan.cases.get(issue.case)?.by === 'tester';
    if (issue.case !== undefined && !ofCase && !closedByTester) {
      verification = rejected('unknown_case' as Verification['reason']);
    } else if (!issue.signal && !issue.observed && !ofCase) {
      verification = rejected('no_claim');
    } else if (issue.signal && !signal) {
      verification = rejected('unknown_signal');
    } else if (ofCase && sabotaged('tester_case_not_replayed')) {
      verification = {
        status: 'confirmed',
        attempts: 0,
        reproduced: 0,
        rate: 1,
      };
    } else {
      if (signal) named.add(signal.id);
      let claim: Claim;
      if (signal) {
        claim = { step: signal.step, signal };
      } else if (ofCase) {
        claim = ofCase as Claim;
      } else {
        const observed = issue.observed as Expectation;
        const read = session.snapshot.previous;
        const about = observed.element?.ref ?? observed.value?.ref;
        const locator =
          about && read
            ? locatorOf(read.elements, read.containers, about)
            : undefined;
        claim = {
          step: observed.step ?? session.step_count,
          observed: { ...observed, ...(locator ? { locator } : {}) },
        };
      }
      verification = await verifyClaim(
        session,
        claim,
        deadline,
        join(root, `issue-${i + 1}`),
        false,
      );
    }
    const verified = { ...issue, verification } as VerifiedIssue;
    if (
      verification.status === 'rejected' &&
      !sabotaged('evidence_rejected_reported')
    ) {
      out.rejected.push(verified);
    } else {
      out.issues_found.push(verified);
    }
  }

  for (const signal of signals) {
    const verification = named.has(signal.id)
      ? (out.issues_found.find((i) => i.signal === signal.id)?.verification ??
        rejected('not_reproduced'))
      : await verifyClaim(
          session,
          { step: signal.step, signal },
          deadline,
          join(root, signal.id),
          true,
        );
    out.signal_verification[signal.id] = verification;
  }
  return out;
}
