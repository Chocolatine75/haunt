// mcp-server/src/engine/evidence/recording.ts
//
// What a session did, kept so that a browser that has never seen the page
// can do it again (R-E4 … R-E7). References are the session's own: another
// session numbers elements differently, so each one an action named is kept
// as a locator, built from the snapshot the action was taken on.
import type {
  Action,
  SnapshotContainer,
  SnapshotElement,
} from '../../gates/part-1/contract.js';
import type { Locator, RecordedStep } from '../../gates/part-3/contract.js';
import { sabotaged } from '../sabotage.js';

// The fields of an action that hold a reference.
export const REF_FIELDS = ['ref', 'from_ref', 'to_ref'] as const;

// What an action's reference becomes in a recorded step.
export const REF_PLACEHOLDER = '@ref';

export interface Recording {
  start_url: string;
  viewport: { width: number; height: number };
  // What haunt_spawn was given, but the cookies, which are never kept.
  spawn: Record<string, unknown>;
  steps: RecordedStep[];
  // Each value typed into a credential field, and what stands for it.
  secrets: Map<string, string>;
}

export function newRecording(
  start_url: string,
  viewport: { width: number; height: number },
  spawn: Record<string, unknown>,
): Recording {
  const { cookies: _cookies, secrets: _secrets, ...kept } = spawn;
  return { start_url, viewport, spawn: kept, steps: [], secrets: new Map() };
}

// Where a container sits, as a replay can find it again: a frame by its URL
// path and its index among the frames beside it with that path, a shadow
// root by its index among the shadow roots beside it.
function containerStep(
  containers: SnapshotContainer[],
  id: string,
): Locator['path'][number] | undefined {
  const container = containers.find((c) => c.id === id);
  if (!container) return undefined;
  const parent = JSON.stringify(container.path);
  const beside = containers.filter(
    (c) => c.kind === container.kind && JSON.stringify(c.path) === parent,
  );
  if (container.kind === 'shadow') {
    return { shadow: beside.indexOf(container) };
  }
  const pathOf = (url = '') => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };
  const same = beside.filter((c) => pathOf(c.url) === pathOf(container.url));
  return { frame: pathOf(container.url), index: same.indexOf(container) };
}

function pathOf(
  containers: SnapshotContainer[],
  element: SnapshotElement,
): Locator['path'] | undefined {
  const path: Locator['path'] = [];
  for (const id of element.path) {
    const step = containerStep(containers, id);
    if (!step) return undefined;
    path.push(step);
  }
  return path;
}

// The locator of the element a reference names in a snapshot.
export function locatorOf(
  elements: SnapshotElement[],
  containers: SnapshotContainer[],
  ref: string,
): Locator | undefined {
  const element = elements.find((e) => e.ref === ref);
  if (!element) return undefined;
  const path = pathOf(containers, element);
  if (!path) return undefined;
  const key = JSON.stringify(path);
  const same = elements.filter(
    (e) =>
      e.role === element.role &&
      e.name === element.name &&
      JSON.stringify(pathOf(containers, e)) === key,
  );
  return {
    role: element.role,
    name: element.name,
    index: same.indexOf(element),
    path,
  };
}

// The reference, in a snapshot of another session, of the element a
// locator describes; undefined unless exactly that element is found.
export function refFor(
  elements: SnapshotElement[],
  containers: SnapshotContainer[],
  locator: Locator,
): string | undefined {
  const key = JSON.stringify(locator.path);
  const same = elements.filter(
    (e) =>
      e.role === locator.role &&
      e.name === locator.name &&
      JSON.stringify(pathOf(containers, e)) === key,
  );
  return same[locator.index]?.ref;
}

// Records a step that ran. The action is kept without its references, and
// with what was typed into a credential field replaced by its placeholder.
export function record(
  recording: Recording,
  step: number,
  action: Action,
  locators: Record<string, Locator>,
  typedSecret: boolean,
): void {
  const kept = { ...action } as Record<string, unknown>;
  // Sabotage only: the session's references kept, which mean nothing to
  // another session.
  if (!sabotaged('evidence_refs_not_locators')) {
    for (const field of REF_FIELDS) {
      if (typeof kept[field] === 'string') kept[field] = REF_PLACEHOLDER;
    }
  }
  if (typedSecret && typeof kept.text === 'string') {
    const text = kept.text;
    let placeholder = recording.secrets.get(text);
    if (!placeholder) {
      placeholder = `{{secret:${recording.secrets.size + 1}}}`;
      recording.secrets.set(text, placeholder);
    }
    kept.text = placeholder;
  }
  recording.steps.push({ step, action: kept as unknown as Action, locators });
}
