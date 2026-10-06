// mcp-server/src/engine/plan/expect.ts
//
// Checking what a tester said it expected (part 4, R-T7 … R-T9): the two
// observations part 4 adds to part 3's, a list read exactly and the state
// of a control. Used when an action states an expectation, and again when a
// replay checks an issue's claim.
import type { Locator } from '../../gates/part-3/contract.js';
import type {
  Expectation,
  ExpectationResult,
  ListCondition,
  ListQuery,
} from '../../gates/part-4/contract.js';
import { controlState, locate } from '../act/page-fns.js';
import { refFor } from '../evidence/recording.js';
import { sabotaged } from '../sabotage.js';
import { takeSnapshot } from '../snapshot/snapshot.js';
import type { HauntSession } from '../types.js';

const KINDS = [
  'text_present',
  'text_absent',
  'url',
  'element',
  'list',
  'value',
] as const;

// Says what is wrong with an expectation, or nothing. Exactly one kind: two
// would leave open which of them an issue claims.
export function malformed(expectation: unknown): string | undefined {
  if (!expectation || typeof expectation !== 'object') {
    return 'An expectation is an object with one observation.';
  }
  const given = KINDS.filter(
    (kind) => (expectation as Record<string, unknown>)[kind] !== undefined,
  );
  if (given.length !== 1) {
    return `An expectation states exactly one of ${KINDS.join(', ')}; this one states ${given.length ? given.join(' and ') : 'none'}.`;
  }
  return undefined;
}

// The first number written in a text: "$1,050.00" is 1050.
const numberIn = (text: string): number =>
  Number((/-?\d[\d,]*(\.\d+)?/.exec(text)?.[0] ?? 'NaN').replaceAll(',', ''));

// The items of a container, as the page shows them (R-T8): every frame is
// asked, since a tester names a list, not where it lives.
export async function readList(
  session: HauntSession,
  query: ListQuery,
): Promise<string[]> {
  if (sabotaged('tester_list_unscoped')) {
    const everywhere = await Promise.all(
      session.page.frames().map((frame) =>
        frame
          // biome-ignore lint/suspicious/noExplicitAny: a role given by the tester
          .getByRole(query.items as any)
          .allInnerTexts()
          .catch(() => [] as string[]),
      ),
    );
    return everywhere.flat().map((text) => text.trim());
  }
  const read = await Promise.all(
    session.page.frames().map((frame) =>
      frame
        // biome-ignore lint/suspicious/noExplicitAny: a role given by the tester
        .getByRole(query.within.role as any, {
          name: query.within.name,
          exact: true,
        })
        // biome-ignore lint/suspicious/noExplicitAny: a role given by the tester
        .getByRole(query.items as any)
        .allInnerTexts()
        .catch(() => [] as string[]),
    ),
  );
  return read.flat().map((text) => text.trim());
}

function listHolds(items: string[], condition: ListCondition): boolean {
  const { count, every_contains, none_contains, order, equals } = condition;
  const has = (text: string, part: string) =>
    text.toLowerCase().includes(part.toLowerCase());
  if (count?.eq !== undefined && items.length !== count.eq) return false;
  if (count?.min !== undefined && items.length < count.min) return false;
  if (count?.max !== undefined && items.length > count.max) return false;
  if (
    every_contains !== undefined &&
    !items.every((text) => has(text, every_contains))
  ) {
    return false;
  }
  if (
    none_contains !== undefined &&
    items.some((text) => has(text, none_contains))
  ) {
    return false;
  }
  if (order) {
    const keys: Array<number | string> =
      condition.as === 'number' ? items.map(numberIn) : items;
    for (let i = 1; i < keys.length; i++) {
      const before = keys[i - 1];
      const ok = order === 'ascending' ? before <= keys[i] : before >= keys[i];
      // A text that holds no number is in no numeric order.
      if (!ok || Number.isNaN(keys[i]) || Number.isNaN(before)) return false;
    }
  }
  if (equals && JSON.stringify(items) !== JSON.stringify(equals)) return false;
  return true;
}

// Checks a list or a value. `locator` stands for `value.ref` in a replay,
// whose references are its own. Undefined for the observations of part 3,
// which evidence/replay.ts checks.
export async function check(
  session: HauntSession,
  expectation: Expectation & { locator?: Locator },
): Promise<ExpectationResult | undefined> {
  if (expectation.list) {
    const read = await readList(session, expectation.list);
    return { held: listHolds(read, expectation.list), read };
  }
  if (expectation.value) {
    let ref: string | undefined = expectation.value.ref;
    if (expectation.locator) {
      const now = await takeSnapshot(session, { format: 'json' }, true);
      ref = refFor(
        now.elements ?? [],
        now.containers ?? [],
        expectation.locator,
      );
    }
    const target = ref ? session.snapshot.targets.get(ref) : undefined;
    if (!target || target.frame.isDetached())
      return { held: false, read: null };
    const handle = (
      await target.frame.evaluateHandle(locate, {
        doc: target.doc,
        local: target.local,
      })
    ).asElement();
    let read = handle
      ? await handle.evaluate(controlState, expectation.value.of)
      : null;
    if (
      sabotaged('tester_secret_read') &&
      handle &&
      expectation.value.of === 'value'
    ) {
      read = await handle.evaluate((el) => (el as HTMLInputElement).value);
      return { held: true, read };
    }
    return { held: read === expectation.value.is, read };
  }
  return undefined;
}
