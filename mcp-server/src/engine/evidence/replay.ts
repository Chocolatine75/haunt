// mcp-server/src/engine/evidence/replay.ts
//
// Plays recorded steps again in a browser that has never seen the page
// (R-E5) and says whether the claim held: the same signal raised (R-E3), or
// the observation true of the page.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Signal } from '../../gates/part-2/contract.js';
import type {
  Locator,
  Observation,
  RecordedStep,
  ReplayInput,
  ReplayOutput,
  StepsFile,
} from '../../gates/part-3/contract.js';
import { hauntAct } from '../act/act.js';
import { lastEffects } from '../end-session.js';
import { sabotaged } from '../sabotage.js';
import { SessionManager } from '../session/manager.js';
import { takeSnapshot } from '../snapshot/snapshot.js';
import { hauntSpawn } from '../spawn.js';
import type { HauntSession } from '../types.js';
import { REF_FIELDS, REF_PLACEHOLDER, refFor } from './recording.js';
import { maskedScreenshot } from './screenshot.js';
import { readZip, redactZip } from './zip.js';

const PLACEHOLDER = /^\{\{secret:\d+\}\}$/;

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  ms: number;
}

// What a replay that reproduced its claim leaves behind for a bundle.
export interface ReplayEvidence {
  screenshot: Buffer;
  network: NetworkEntry[];
  // Where the trace was written, already rid of the session's secrets.
  trace?: string;
  signal?: Signal;
}

export interface ReplayRun {
  outcome: 'reproduced' | 'not_reproduced' | 'not_replayable';
  reproduced: boolean;
  failed_step?: number;
  signal?: Signal;
  evidence?: ReplayEvidence;
}

export interface ReplayOptions {
  secrets?: Record<string, string>;
  cookies?: Parameters<typeof hauntSpawn>[1]['cookies'];
  // What the session was told to keep out though it never typed it: the
  // account it was signed in with (R-E15).
  known?: string[];
  // A directory to write the trace into, when the evidence is wanted.
  evidenceDir?: string;
}

// Two signals are the same when they say the same thing about the same
// request or element; when and how often are not compared (R-E3). The
// message of a timing signal holds its duration, so it is left out there.
export function sameSignal(a: Signal, b: Signal): boolean {
  if (a.kind !== b.kind) return false;
  const fields = (s: Signal) => {
    const all = s as unknown as Record<string, unknown>;
    const path = (url: unknown) => {
      try {
        return new URL(String(url)).pathname;
      } catch {
        return undefined;
      }
    };
    const timed = ['slow_response', 'long_task', 'request_hung'];
    return JSON.stringify([
      path(all.request_url),
      all.status,
      all.error,
      all.rule,
      all.nodes,
      all.role,
      all.name,
      timed.includes(s.kind) ? undefined : s.message,
    ]);
  };
  return fields(a) === fields(b);
}

// The page's text in every frame.
async function textOf(session: HauntSession): Promise<string> {
  const texts = await Promise.all(
    session.page
      .frames()
      .map((frame) =>
        frame.evaluate(() => document.body?.innerText ?? '').catch(() => ''),
      ),
  );
  return texts.join('\n');
}

async function holds(
  session: HauntSession,
  observed: Observation & { locator?: Locator },
): Promise<boolean> {
  if (observed.text_present !== undefined) {
    return (await textOf(session)).includes(observed.text_present);
  }
  if (observed.text_absent !== undefined) {
    return !(await textOf(session)).includes(observed.text_absent);
  }
  if (observed.url !== undefined) {
    return session.page.url().includes(observed.url);
  }
  if (observed.element && observed.locator) {
    const read = await takeSnapshot(session, { format: 'json' }, true);
    const ref = refFor(
      read.elements ?? [],
      read.containers ?? [],
      observed.locator,
    );
    const element = read.elements?.find((e) => e.ref === ref);
    switch (observed.element.state) {
      case 'gone':
        return !element;
      case 'visible':
        return Boolean(element && !element.hidden);
      case 'hidden':
        return Boolean(element?.hidden);
      case 'disabled':
        return Boolean(element?.disabled);
      case 'enabled':
        return Boolean(element && !element.disabled);
    }
  }
  return false;
}

// The action of a recorded step, with references for this session and the
// secrets put back; undefined when a locator matches nothing here.
async function actionFor(
  session: HauntSession,
  step: RecordedStep,
  secrets: Record<string, string>,
): Promise<Record<string, unknown> | undefined> {
  const action = { ...step.action } as Record<string, unknown>;
  const needs = REF_FIELDS.filter((f) => action[f] === REF_PLACEHOLDER);
  if (needs.length > 0) {
    const read = await takeSnapshot(session, { format: 'json' }, true);
    for (const field of needs) {
      const locator = step.locators[field];
      const ref =
        locator && refFor(read.elements ?? [], read.containers ?? [], locator);
      if (!ref) return undefined;
      action[field] = ref;
    }
  }
  if (typeof action.text === 'string' && PLACEHOLDER.test(action.text)) {
    action.text = secrets[action.text] ?? action.text;
  }
  return action;
}

export async function replay(
  file: StepsFile,
  options: ReplayOptions = {},
): Promise<ReplayRun> {
  const manager = new SessionManager();
  const claim = file.claim;
  const spawned = await hauntSpawn(manager, {
    ...(file.spawn as Record<string, unknown>),
    persona: String(file.spawn.persona),
    target_url: file.start_url,
    cookies: options.cookies,
    secrets: options.known,
    timeout: file.steps.length + 5,
    // A replay is not a session of its own: no audit unless the claim is
    // about one, and no replays of its replays.
    audit: 'signal' in claim && claim.signal.kind === 'a11y',
    replay_budget_ms: 0,
  } as Parameters<typeof hauntSpawn>[1]);
  const session = manager.get(spawned.session_id);
  const context = session.page.context();
  const network: NetworkEntry[] = [];
  const started = new Map<unknown, number>();
  context.on('request', (request) => started.set(request, Date.now()));
  context.on('response', (response) => {
    const request = response.request();
    let url = request.url();
    try {
      const parsed = new URL(url);
      url = `${parsed.origin}${parsed.pathname}`;
    } catch {
      // Kept as it is: not a URL a query can hide in.
    }
    network.push({
      method: request.method(),
      url,
      status: response.status(),
      ms: Date.now() - (started.get(request) ?? Date.now()),
    });
  });
  if (options.evidenceDir) {
    await context.tracing.start({ snapshots: true, screenshots: false });
  }
  const secrets = options.secrets ?? {};
  try {
    for (const step of file.steps) {
      if (step.step > claim.step) break;
      const action = await actionFor(session, step, secrets);
      if (!action) {
        return {
          outcome: 'not_replayable',
          reproduced: false,
          failed_step: step.step,
        };
      }
      const result = await hauntAct(manager, {
        session_id: spawned.session_id,
        actions: [action],
      });
      if (!result.results[0]?.ok) {
        return {
          outcome: 'not_replayable',
          reproduced: false,
          failed_step: step.step,
        };
      }
    }
    // What the last step set in motion, as the session end waits for it.
    await lastEffects(session);

    let reproduced: boolean;
    let signal: Signal | undefined;
    if ('signal' in claim) {
      signal = session.collector.all().find((s) => sameSignal(s, claim.signal));
      reproduced = Boolean(signal);
    } else {
      reproduced = await holds(session, claim.observed);
    }
    const run: ReplayRun = {
      outcome: reproduced ? 'reproduced' : 'not_reproduced',
      reproduced,
      signal,
    };
    if (reproduced && options.evidenceDir) {
      const trace = join(options.evidenceDir, 'trace.zip');
      await context.tracing.stop({ path: trace });
      // What was typed in the replay is in the trace's actions and in its
      // snapshots of the fields; the cookies passed in, in its requests. The
      // server may have set others since: a NextAuth session cookie is
      // issued anew on every response, so the one passed in is not the one
      // the trace holds most of the time.
      for (const value of Object.values(secrets)) {
        session.collector.addSecret(value);
      }
      for (const cookie of await context.cookies().catch(() => [])) {
        session.collector.addToken(cookie.value);
      }
      for (const token of tokensIn(readZip(trace))) {
        session.collector.addToken(token);
      }
      if (!sabotaged('evidence_secrets_in_trace')) {
        redactZip(trace, (text) => session.collector.redact(text));
      }
      run.evidence = {
        screenshot: await maskedScreenshot(session.page),
        network,
        trace,
        signal,
      };
    }
    return run;
  } finally {
    await session.browser.close().catch(() => {});
    manager.delete(spawned.session_id);
  }
}

// The headers that carry a session: what a request sends and what a
// response sets.
const TOKEN_HEADERS = new Set(['cookie', 'set-cookie', 'authorization']);

// Every cookie value and bearer token in a trace's requests and responses.
// The trace's network records are JSON lines whose headers are
// { name, value } pairs.
export function tokensIn(entries: Array<[string, Buffer]>): string[] {
  const found = new Set<string>();
  const take = (name: string, value: string) => {
    const header = name.toLowerCase();
    const parts =
      header === 'authorization'
        ? [value.split(' ').pop() ?? '']
        : value
            .split(header === 'cookie' ? ';' : '\n')
            .map((pair) => pair.split(';')[0]);
    for (const part of parts) {
      const raw = header === 'authorization' ? part : part.split('=')[1];
      const token = raw?.trim().replace(/^"(.*)"$/, '$1');
      if (!token) continue;
      found.add(token);
      try {
        found.add(decodeURIComponent(token));
      } catch {
        // Not URL-encoded after all.
      }
    }
  };
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else if (value && typeof value === 'object') {
      const { name, value: inner } = value as Record<string, unknown>;
      if (
        typeof name === 'string' &&
        typeof inner === 'string' &&
        TOKEN_HEADERS.has(name.toLowerCase())
      ) {
        take(name, inner);
      }
      for (const child of Object.values(value)) walk(child);
    }
  };
  for (const [name, data] of entries) {
    if (!/\.(trace|network)$/.test(name)) continue;
    for (const line of data.toString('utf-8').split('\n')) {
      if (!line) continue;
      try {
        walk(JSON.parse(line));
      } catch {
        // Not a record.
      }
    }
  }
  return [...found];
}

// haunt_replay (R-E14): a bundle, and nothing else but its secrets.
export async function hauntReplay(input: ReplayInput): Promise<ReplayOutput> {
  const path =
    existsSync(input.bundle) && statSync(input.bundle).isDirectory()
      ? join(input.bundle, 'steps.json')
      : input.bundle;
  if (!existsSync(path)) throw new Error(`No steps.json at ${path}`);
  const file = JSON.parse(readFileSync(path, 'utf-8')) as StepsFile;
  if (file.version !== 1 || !Array.isArray(file.steps)) {
    throw new Error(`${path} is not a haunt steps file`);
  }
  const run = await replay(file, {
    secrets: input.secrets,
    cookies: input.cookies as ReplayOptions['cookies'],
  });
  const output: ReplayOutput = {
    reproduced: run.reproduced,
    outcome: run.outcome,
  };
  if (run.failed_step !== undefined) output.failed_step = run.failed_step;
  if (run.signal) output.signal = run.signal;
  return output;
}
