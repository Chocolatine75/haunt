// mcp-server/src/engine/act/act.ts
//
// haunt_act: runs structured actions on elements named by reference, and
// reports what each one really did. Specified in docs/v3/part-1-actions.md;
// the result shape is fixed by gates/part-1/contract.ts.
import { existsSync } from 'node:fs';
import type { ElementHandle, Frame, Page } from 'playwright';
import type {
  ActResult,
  ActionChanges,
  ActionError,
  FailureCode,
  SnapshotDiff,
  StepResult,
  StopReason,
} from '../../gates/part-1/contract.js';
import { SESSION_TTL_MS } from '../constants.js';
import { sabotaged } from '../sabotage.js';
import type { SessionManager } from '../session/manager.js';
import {
  diffBetween,
  refOfLocal,
  similarTo,
  takeSnapshot,
  textChanges,
} from '../snapshot/snapshot.js';
import type { HauntSession, Issue } from '../types.js';
import {
  type Probe,
  fileInputFor,
  focusedId,
  hasText,
  listOptions,
  locate,
  probe,
  scrollBy,
  scrollToText,
  sinceMutation,
  waitQuiet,
} from './page-fns.js';
import { type ValidatedAction, validateAction } from './schema.js';

// However busy the page stays, an action returns within this long.
export const SETTLE_CAP_MS = 5_000;
// How long the page must have been still to count as settled.
const QUIET_MS = 60;
// How long an action waits for its target to become usable before failing.
const ACTIONABLE_MS = 1_700;
const NAVIGATION_MS = 15_000;

export interface ActInput {
  session_id: string;
  actions: unknown[];
  issues?: Issue[];
}

class ActionFailure extends Error {
  constructor(readonly detail: ActionError) {
    super(detail.message);
  }
}

function fail(
  code: FailureCode,
  message: string,
  extra: Partial<ActionError> = {},
): never {
  throw new ActionFailure({ code, message, ...extra });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), ms),
    ),
  ]);
}

// Runs something that may open a dialog. A dialog freezes the page, and with
// it the call that caused it, so the wait ends when either happens.
async function unlessDialog(
  session: HauntSession,
  work: Promise<unknown>,
): Promise<void> {
  const { runtime } = session;
  if (runtime.dialog) return;
  let wake: () => void = () => {};
  const opened = new Promise<'dialog'>((resolve) => {
    wake = () => resolve('dialog');
    runtime.dialogWaiters.add(wake);
  });
  try {
    const first = await Promise.race([
      work.then(() => 'done' as const),
      opened,
    ]);
    // The frozen call resolves once the dialog is answered; nobody is
    // waiting for it any more.
    if (first === 'dialog') work.catch(() => {});
  } finally {
    runtime.dialogWaiters.delete(wake);
  }
}

// ---------------------------------------------------------------------------
// From a reference to an element that can take the action
// ---------------------------------------------------------------------------

interface Resolved {
  handle: ElementHandle<Element>;
  frame: Frame;
}

async function resolve(session: HauntSession, ref: string): Promise<Resolved> {
  const target = session.snapshot.targets.get(ref);
  if (!target) {
    fail(
      'unknown_ref',
      `No element has the reference ${ref}. Take a snapshot and use a reference from it.`,
    );
  }
  const found = target.frame.isDetached()
    ? undefined
    : await withTimeout(
        target.frame.evaluateHandle(locate, {
          doc: target.doc,
          local: target.local,
        }),
        2_000,
      );
  const handle = found?.asElement();
  if (handle)
    return { handle: handle as ElementHandle<Element>, frame: target.frame };

  // The node is gone. Say so, and point at what replaced it if something did.
  const current = await takeSnapshot(session, { format: 'json' }, true);
  const similar = similarTo(session, ref, current.elements ?? []);
  if (similar && sabotaged('stale_resolved_by_name'))
    return resolve(session, similar);
  fail(
    'stale_ref',
    similar
      ? `The element ${ref} referred to no longer exists; it was replaced by ${similar}.`
      : `The element ${ref} referred to no longer exists.`,
    { similar_ref: similar },
  );
}

interface Ready extends Resolved {
  probe: Probe;
  // Centre of the element, in viewport coordinates of the tab.
  x: number;
  y: number;
}

// Waits until the element can take the action, the way a user would have to:
// there, visible, enabled, still, and (for pointer actions) not covered.
async function ready(
  session: HauntSession,
  ref: string,
  options: { pointer: boolean },
): Promise<Ready> {
  const deadline = Date.now() + ACTIONABLE_MS;
  let centre = false;
  for (;;) {
    const { handle, frame } = await resolve(session, ref);
    const state = await withTimeout(handle.evaluate(probe, centre), 3_000);
    const last = Date.now() >= deadline;

    if (!state || !state.connected) {
      // It went away while being looked at. Resolving again says so, with
      // what replaced it; if it is somehow back, look again.
      await resolve(session, ref);
      if (!last) continue;
      fail('stale_ref', `The element ${ref} referred to no longer exists.`);
    }
    if (state.disabled) {
      fail('disabled', `${ref} is disabled, so it cannot be used.`);
    }
    if (state.hidden) {
      if (last) {
        const why = {
          display: 'it is not rendered (display: none)',
          visibility: 'it is invisible (visibility: hidden)',
          zero_size: 'it has no size',
        }[state.hidden];
        fail('not_visible', `${ref} cannot be seen: ${why}.`, {
          reason: state.hidden,
        });
      }
    } else if (options.pointer && !sabotaged('no_actionability_check')) {
      if (state.ignores_pointer) {
        fail(
          'covered',
          `${ref} ignores the pointer (pointer-events: none): a click there goes to whatever is behind it.`,
        );
      }
      if (state.covered_by !== undefined && !sabotaged('ok_on_covered')) {
        if (!centre) {
          // Perhaps only where the least scrolling left it: try the middle.
          centre = true;
          continue;
        }
        if (last) {
          const target = session.snapshot.targets.get(ref);
          const cover = refOfLocal(
            session,
            frame,
            target?.doc ?? '',
            state.covered_by,
          );
          fail(
            'covered',
            `${ref} is covered by ${cover}, which would receive the click instead.`,
            {
              covered_by: cover,
            },
          );
        }
      } else if (state.stable) {
        let box = await handle.boundingBox();
        const view = session.page.viewportSize();
        const cx = box ? box.x + box.width / 2 : -1;
        const cy = box ? box.y + box.height / 2 : -1;
        if (
          box &&
          view &&
          (cx < 0 || cy < 0 || cx > view.width || cy > view.height)
        ) {
          // In view inside its frame, but the frame itself is not on screen.
          await handle
            .scrollIntoViewIfNeeded({ timeout: 1_000 })
            .catch(() => {});
          box = await handle.boundingBox();
        }
        if (box) {
          return {
            handle,
            frame,
            probe: state,
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          };
        }
      }
    } else {
      const box = await handle.boundingBox();
      return {
        handle,
        frame,
        probe: state,
        x: box ? box.x + box.width / 2 : 0,
        y: box ? box.y + box.height / 2 : 0,
      };
    }
    await sleep(40);
  }
}

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

interface Outcome {
  options?: StepResult['options'];
  text?: string;
}

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Esc: 'Escape',
  Return: 'Enter',
};

async function pressKey(session: HauntSession, key: string): Promise<void> {
  const name = KEY_ALIASES[key] ?? key;
  try {
    await unlessDialog(session, session.page.keyboard.press(name));
  } catch (error) {
    if (error instanceof Error && /Unknown key/.test(error.message)) {
      fail('invalid_action', `Unknown key ${JSON.stringify(key)}.`, {
        parameter: 'keys',
      });
    }
    throw error;
  }
}

// Types text the way a keyboard would: real key events for what a keyboard
// has, and the character itself for everything else. The text is data: a
// tab is a tab character, never a jump to the next field.
async function typeText(
  session: HauntSession,
  text: string,
  delay?: number,
): Promise<void> {
  const { keyboard } = session.page;
  let run = '';
  const flush = async () => {
    if (run) await keyboard.type(run, { delay });
    run = '';
  };
  for (const char of Array.from(text)) {
    if (char === '\n') {
      await flush();
      await unlessDialog(session, keyboard.press('Enter'));
    } else if (char.length === 1 && char >= ' ' && char <= '~') {
      run += char;
    } else {
      await flush();
      await keyboard.insertText(char);
    }
  }
  await flush();
}

async function focus(handle: ElementHandle<Element>): Promise<void> {
  await handle.evaluate((el) => (el as HTMLElement).focus());
}

async function centreOf(
  handle: ElementHandle<Element>,
): Promise<{ x: number; y: number }> {
  const box = await handle.boundingBox();
  if (!box)
    fail('not_visible', 'The drop target cannot be seen.', {
      reason: 'display',
    });
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function navigationFailure(
  session: HauntSession,
  blockedBefore: number,
  error: unknown,
): never {
  const blocked = session.sandbox_blocked_requests.slice(blockedBefore);
  if (blocked.length > 0) {
    fail(
      'sandbox_blocked',
      'Blocked by the haunt test sandbox: the address is outside the app under test. This is not an app bug.',
      { blocked: blocked[blocked.length - 1] },
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid URL/i.test(message)) {
    fail('invalid_action', 'That is not a URL that can be opened.', {
      parameter: 'url',
    });
  }
  const net = message.match(/net::[A-Z_]+/)?.[0] ?? 'the page did not load';
  fail('navigation_failed', `The page could not be loaded (${net}).`, {
    status: net,
  });
}

async function execute(
  session: HauntSession,
  action: ValidatedAction,
): Promise<Outcome> {
  const page = session.page;
  const { runtime } = session;

  switch (action.type) {
    case 'click': {
      const target = await ready(session, action.ref, { pointer: true });
      if (sabotaged('scripted_click')) {
        await target.handle.evaluate((el) => (el as HTMLElement).click());
        return {};
      }
      const modifiers = action.modifiers ?? [];
      for (const key of modifiers) await page.keyboard.down(key);
      try {
        await unlessDialog(
          session,
          page.mouse.click(target.x, target.y, {
            button: action.button ?? 'left',
            clickCount: action.count ?? 1,
          }),
        );
      } finally {
        if (!runtime.dialog)
          for (const key of modifiers) await page.keyboard.up(key);
      }
      return {};
    }

    case 'fill': {
      const target = await ready(session, action.ref, { pointer: false });
      const { probe: p, handle } = target;
      if (p.editable === 'none' || p.readonly) {
        fail(
          'not_editable',
          p.readonly
            ? `${action.ref} is read-only.`
            : `${action.ref} is a ${p.role}, which takes no text.`,
          { role: p.role },
        );
      }
      if (p.input_type === 'range') {
        // No text entry exists for a slider; set it the way the page's own
        // script would see a user's change.
        await handle.evaluate((el, value) => {
          const input = el as HTMLInputElement;
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          )?.set?.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, action.text);
      } else if (action.clear === false) {
        await focus(handle);
        await handle.evaluate((el) => {
          if (
            el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement
          ) {
            try {
              el.setSelectionRange(el.value.length, el.value.length);
            } catch {
              // Not every input type has a caret.
            }
          } else {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            getSelection()?.removeAllRanges();
            getSelection()?.addRange(range);
          }
        });
        await page.keyboard.insertText(action.text);
      } else {
        try {
          await handle.fill(action.text, { force: true, timeout: 1_500 });
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (/Malformed value|Cannot type text into/.test(message)) {
            fail(
              'invalid_action',
              `That text is not a valid value for a ${p.input_type} field.`,
              {
                parameter: 'text',
              },
            );
          }
          throw error;
        }
      }
      if (action.submit) {
        await focus(handle);
        await pressKey(session, 'Enter');
      }
      return {};
    }

    case 'type': {
      if (action.ref) {
        const target = await ready(session, action.ref, { pointer: false });
        if (
          target.probe.editable === 'none' &&
          target.probe.role !== 'combobox'
        ) {
          fail(
            'not_editable',
            `${action.ref} is a ${target.probe.role}, which takes no text.`,
            {
              role: target.probe.role,
            },
          );
        }
        await focus(target.handle);
      }
      await typeText(session, action.text, action.delay_ms);
      return {};
    }

    case 'press': {
      if (action.ref) {
        const target = await ready(session, action.ref, { pointer: false });
        await focus(target.handle);
      }
      const keys = Array.isArray(action.keys) ? action.keys : [action.keys];
      for (const key of keys) {
        if (runtime.dialog) break;
        await pressKey(session, key);
      }
      return {};
    }

    case 'select': {
      const target = await ready(session, action.ref, { pointer: false });
      if (target.probe.tag !== 'select') {
        fail(
          'not_editable',
          `${action.ref} is not a native select; open it and click the option instead.`,
          {
            role: target.probe.role,
          },
        );
      }
      const options = (await target.handle.evaluate(listOptions)) ?? [];
      const chosen = action.values.map((wanted) =>
        options.find(
          (o) => !o.disabled && (o.label === wanted || o.value === wanted),
        ),
      );
      const missing = action.values.filter((_, i) => !chosen[i]);
      if (missing.length > 0) {
        fail(
          'no_such_option',
          `No selectable option matches ${missing.map((m) => JSON.stringify(m)).join(', ')}.`,
          { options: options.map((o) => o.label) },
        );
      }
      await target.handle.selectOption(
        chosen.map((o) => ({ value: (o as { value: string }).value })),
        { force: true, timeout: 1_500 },
      );
      return {};
    }

    case 'options': {
      const { handle } = await resolve(session, action.ref);
      const options = await handle.evaluate(listOptions);
      if (!options) {
        fail('not_editable', `${action.ref} has no list of options.`, {
          role: 'generic',
        });
      }
      return { options };
    }

    case 'check': {
      const target = await ready(session, action.ref, { pointer: true });
      if (target.probe.checked === undefined) {
        fail(
          'not_editable',
          `${action.ref} is a ${target.probe.role}, which has no checked state.`,
          {
            role: target.probe.role,
          },
        );
      }
      // Already in the state asked for: touching it would be an action the
      // tester did not ask for.
      if (target.probe.checked === action.checked) return {};
      if (target.probe.input_type === 'radio' && !action.checked) {
        fail(
          'invalid_action',
          'A radio button cannot be unchecked; check another one.',
          {
            parameter: 'checked',
          },
        );
      }
      await unlessDialog(session, page.mouse.click(target.x, target.y));
      return {};
    }

    case 'hover': {
      const target = await ready(session, action.ref, { pointer: true });
      await page.mouse.move(target.x, target.y, { steps: 4 });
      return {};
    }

    case 'scroll': {
      const handle = action.ref
        ? (await resolve(session, action.ref)).handle
        : ((await page.evaluateHandle(
            () => document.documentElement,
          )) as ElementHandle<Element>);
      await handle.evaluate(scrollBy, {
        direction: action.direction,
        amount: action.amount,
      });
      return {};
    }

    case 'scroll_to': {
      if (action.ref) {
        const { handle } = await resolve(session, action.ref);
        await handle.evaluate((el) =>
          el.scrollIntoView({
            block: 'center',
            inline: 'center',
            behavior: 'instant' as ScrollBehavior,
          }),
        );
        return {};
      }
      for (const frame of page.frames()) {
        if (
          await withTimeout(
            frame.evaluate(scrollToText, action.text as string),
            2_000,
          )
        )
          return {};
      }
      return fail('timeout', 'That text is not on the page.', {
        observed: `text not found on ${page.url()}`,
      });
    }

    case 'drag': {
      const source = await ready(session, action.from_ref, { pointer: true });
      let end = {
        x: source.x + (action.offset?.x ?? 0),
        y: source.y + (action.offset?.y ?? 0),
      };
      if (action.to_ref) {
        const destination = await resolve(session, action.to_ref);
        const centre = await centreOf(destination.handle);
        end = {
          x: centre.x + (action.offset?.x ?? 0),
          y: centre.y + (action.offset?.y ?? 0),
        };
      }
      await page.mouse.move(source.x, source.y);
      await page.mouse.down();
      // Real intermediate moves: drag handlers follow the pointer, they do
      // not teleport.
      await page.mouse.move((source.x + end.x) / 2, (source.y + end.y) / 2, {
        steps: 8,
      });
      await page.mouse.move(end.x, end.y, { steps: 8 });
      await unlessDialog(session, page.mouse.up());
      return {};
    }

    case 'upload': {
      const { handle } = await resolve(session, action.ref);
      const input = (await handle.evaluateHandle(fileInputFor)).asElement();
      if (!input) {
        fail(
          'not_a_file_input',
          `${action.ref} is not a file input and has none attached to it.`,
        );
      }
      const absent = action.files.filter((file) => !existsSync(file));
      if (absent.length > 0) {
        fail('invalid_action', `No such file: ${absent.join(', ')}.`, {
          parameter: 'files',
        });
      }
      await input.setInputFiles(action.files);
      return {};
    }

    case 'goto': {
      const blockedBefore = session.sandbox_blocked_requests.length;
      try {
        await page.goto(action.url, {
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_MS,
        });
      } catch (error) {
        navigationFailure(session, blockedBefore, error);
      }
      return {};
    }

    case 'back':
    case 'forward':
    case 'reload': {
      const options = {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_MS,
      } as const;
      const blockedBefore = session.sandbox_blocked_requests.length;
      try {
        const move =
          action.type === 'back'
            ? page.goBack(options)
            : action.type === 'forward'
              ? page.goForward(options)
              : page.reload(options);
        await unlessDialog(session, move);
      } catch (error) {
        navigationFailure(session, blockedBefore, error);
      }
      return {};
    }

    case 'wait_for': {
      if (action.ms !== undefined) await sleep(action.ms);
      const conditional = [
        action.text,
        action.ref,
        action.gone,
        action.url,
      ].some((v) => v !== undefined);
      if (!conditional) return {};

      const deadline = Date.now() + (action.timeout_ms ?? 1_500);
      const anyFrameHas = async (text: string) => {
        for (const frame of session.page.frames()) {
          if (await withTimeout(frame.evaluate(hasText, text), 1_000))
            return true;
        }
        return false;
      };
      let unmet = '';
      for (;;) {
        if (runtime.dialog) return {};
        unmet = '';
        if (action.text !== undefined && !(await anyFrameHas(action.text))) {
          unmet = `the text ${JSON.stringify(action.text)} is not there`;
        } else if (
          action.gone !== undefined &&
          (await anyFrameHas(action.gone))
        ) {
          unmet = `the text ${JSON.stringify(action.gone)} is still there`;
        } else if (
          action.url !== undefined &&
          !session.page.url().includes(action.url)
        ) {
          unmet = 'the URL does not contain it';
        } else if (action.ref !== undefined) {
          const target = session.snapshot.targets.get(action.ref);
          if (!target)
            fail('unknown_ref', `No element has the reference ${action.ref}.`);
          const handle = target.frame.isDetached()
            ? undefined
            : (
                await withTimeout(
                  target.frame.evaluateHandle(locate, {
                    doc: target.doc,
                    local: target.local,
                  }),
                  1_000,
                )
              )?.asElement();
          const state = handle
            ? await withTimeout(handle.evaluate(probe, false), 2_000)
            : undefined;
          if (!state?.connected) unmet = `${action.ref} is not on the page`;
          else if (state.hidden) unmet = `${action.ref} is hidden`;
        }
        if (!unmet) return {};
        if (Date.now() >= deadline) break;
        await sleep(80);
      }
      const title = (await withTimeout(session.page.title(), 500)) ?? '';
      return fail('timeout', `Waited, but ${unmet}.`, {
        observed: `${unmet}; the page is "${title}" at ${session.page.url()}`,
      });
    }

    case 'tab': {
      if (action.op === 'new') {
        const blockedBefore = session.sandbox_blocked_requests.length;
        const opened = await page.context().newPage();
        if (action.url) {
          try {
            await opened.goto(action.url, {
              waitUntil: 'domcontentloaded',
              timeout: NAVIGATION_MS,
            });
          } catch (error) {
            await opened.close().catch(() => {});
            // Opening and closing it again is not something that happened.
            runtime.opened.length = 0;
            runtime.closed.length = 0;
            navigationFailure(session, blockedBefore, error);
          }
        }
        session.page = opened;
        return {};
      }
      const target = runtime.tabs[action.index as number];
      if (!target) {
        fail(
          'invalid_action',
          `There is no tab ${action.index}; ${runtime.tabs.length} are open.`,
          {
            parameter: 'index',
          },
        );
      }
      if (action.op === 'switch') {
        session.page = target;
        await target.bringToFront().catch(() => {});
        return {};
      }
      if (runtime.tabs.length === 1) {
        fail(
          'invalid_action',
          'The last tab cannot be closed; end the session instead.',
          {
            parameter: 'index',
          },
        );
      }
      const wasActive = target === session.page;
      await target.close();
      if (wasActive) {
        session.page =
          runtime.tabs[Math.max(0, (action.index as number) - 1)] ??
          runtime.tabs[0];
        await session.page.bringToFront().catch(() => {});
      }
      return {};
    }

    case 'dialog': {
      const dialog = runtime.dialog;
      if (!dialog) fail('no_dialog', 'No dialog is open.');
      runtime.dialog = undefined;
      session.snapshot.dialog = undefined;
      if (action.accept) await dialog.accept(action.text);
      else await dialog.dismiss();
      return {};
    }

    case 'resize': {
      await page.setViewportSize({
        width: action.width,
        height: action.height,
      });
      return {};
    }

    case 'read': {
      if (action.ref) {
        const { handle } = await resolve(session, action.ref);
        return {
          text: await handle.evaluate(
            (el) => (el as HTMLElement).innerText ?? el.textContent ?? '',
          ),
        };
      }
      return {
        text: await page.evaluate(() => document.body?.innerText ?? ''),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Settling
// ---------------------------------------------------------------------------

interface Settled {
  settled: boolean;
  pending?: string[];
}

const pathOf = (url: string) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
};

// Waits for the page to finish reacting to an action: nothing on the wire
// that the action started, no short timer it started still pending, the DOM
// still for a moment. Gives up at the cap and says what was still going on.
async function settle(
  session: HauntSession,
  since: number,
  from: number,
  ignoreMutations: boolean,
): Promise<Settled> {
  if (sabotaged('no_settling')) return { settled: true };
  const { runtime } = session;
  const deadline = from + SETTLE_CAP_MS;
  let timers: string[] = [];

  for (;;) {
    if (runtime.dialog) return { settled: true };
    const remaining = deadline - Date.now();
    const frames = session.page.isClosed() ? [] : session.page.frames();
    const slice = Math.max(20, Math.min(remaining, 250));
    const readings = await Promise.all(
      frames.map((frame) =>
        frame.isDetached()
          ? Promise.resolve({ quiet: true, ready: true, timers: [] })
          : withTimeout(
              frame.evaluate(waitQuiet, {
                since,
                from,
                quietMs: QUIET_MS,
                maxMs: slice,
                ignoreMutations,
              }),
              slice + 500,
            ),
      ),
    );
    if (runtime.dialog) return { settled: true };

    const started = [...runtime.inflight.values()].filter((r) => r.at >= since);
    // An unreadable frame is one that is navigating: not settled yet.
    const quiet = readings.every((r) => r?.quiet);
    timers = readings.flatMap((r) => r?.timers ?? []);
    if (quiet && started.length === 0) return { settled: true };

    if (Date.now() >= deadline) {
      const recent = runtime.recent
        .filter((r) => r.at >= since)
        .map((r) => pathOf(r.url));
      const pending = [
        ...new Set([
          ...started.map((r) => pathOf(r.url)),
          ...recent.slice(-5),
          ...timers,
        ]),
      ];
      return { settled: false, pending };
    }
    if (!quiet && readings.some((r) => r === undefined)) await sleep(30);
  }
}

// ---------------------------------------------------------------------------
// One step, and the call
// ---------------------------------------------------------------------------

async function focusOf(session: HauntSession): Promise<number> {
  if (session.runtime.dialog || session.page.isClosed()) return -1;
  return (await withTimeout(session.page.evaluate(focusedId), 1_000)) ?? -1;
}

function isEmpty(diff: SnapshotDiff | undefined): boolean {
  return (
    !diff ||
    (diff.added.length === 0 &&
      diff.removed.length === 0 &&
      diff.changed.length === 0)
  );
}

async function runStep(
  session: HauntSession,
  input: unknown,
): Promise<StepResult> {
  const { runtime } = session;
  const startedAt = Date.now();
  const pageBefore = session.page;
  const urlBefore = pageBefore.url();
  const navigationsBefore = runtime.navigations.get(pageBefore) ?? 0;
  const downloadsBefore = runtime.downloads.length;
  const textBefore = session.snapshot.previous?.textHash;
  const focusBefore = await focusOf(session);
  const dialogBefore = runtime.dialog;
  // A page that changes by itself (a ticking clock, a list rebuilt on a
  // timer) would otherwise never look settled.
  const alreadyChanging =
    !runtime.dialog &&
    ((await withTimeout(session.page.evaluate(sinceMutation), 1_000)) ?? 1e9) <
      150;
  runtime.opened.length = 0;
  runtime.closed.length = 0;

  let type: StepResult['type'] = 'invalid';
  let error: ActionError | undefined;
  let outcome: Outcome = {};

  const validation = validateAction(input);
  if (validation.ok) type = validation.action.type;
  if (!validation.ok) {
    error = {
      code: 'invalid_action',
      message: validation.message,
      parameter: validation.parameter,
    };
  } else if (runtime.dialog && validation.action.type !== 'dialog') {
    const dialog = session.snapshot.dialog ?? { type: 'alert', message: '' };
    error = {
      code: 'dialog_open',
      message: `A ${dialog.type} dialog is open and blocks the page; answer it with a dialog action first.`,
      dialog,
    };
  } else {
    try {
      outcome = await execute(session, validation.action);
    } catch (caught) {
      if (caught instanceof ActionFailure) error = caught.detail;
      else {
        // Something Playwright refused to do. The tester gets the gist, not
        // the call log.
        const message = (
          caught instanceof Error ? caught.message : String(caught)
        ).split('\n')[0];
        error = {
          code: 'timeout',
          message: `The action could not be completed: ${message}`,
          observed: message,
        };
      }
    }
  }
  const actionMs = Date.now() - startedAt;

  const settleFrom = Date.now();
  const settled = error
    ? { settled: true }
    : await settle(session, startedAt, settleFrom, alreadyChanging);
  const settleMs = Date.now() - settleFrom;

  // What the action changed.
  const page = session.page;
  const switched = page !== pageBefore;
  const after = await takeSnapshot(
    session,
    { format: 'json', diff: true },
    true,
  );
  const dialog =
    runtime.dialog && runtime.dialog !== dialogBefore
      ? session.snapshot.dialog
      : undefined;
  const download = runtime.downloads[downloadsBefore];
  const navigated =
    !switched &&
    !page.isClosed() &&
    ((runtime.navigations.get(page) ?? 0) !== navigationsBefore ||
      page.url() !== urlBefore);
  const domChanged =
    !runtime.dialog &&
    (!isEmpty(after.diff) ||
      session.snapshot.previous?.textHash !== textBefore);
  const changes: ActionChanges = {
    url_before: urlBefore,
    url_after: page.isClosed() ? urlBefore : page.url(),
    navigated,
    tabs_opened: [...runtime.opened],
    tabs_closed: [...runtime.closed],
    focus_moved: (await focusOf(session)) !== focusBefore,
    dom_changed: domChanged,
    none: false,
  };
  if (dialog) changes.dialog = dialog;
  if (download) changes.download = { filename: download };
  changes.none =
    !navigated &&
    !switched &&
    changes.tabs_opened.length === 0 &&
    changes.tabs_closed.length === 0 &&
    !dialog &&
    !download &&
    !domChanged;

  const step: StepResult = {
    type,
    ok: !error,
    changes,
    settled: settled.settled,
    action_ms: actionMs,
    settle_ms: settleMs,
  };
  if (error) step.error = error;
  if (settled.pending) step.pending = settled.pending;
  if (outcome.options) step.options = outcome.options;
  if (outcome.text !== undefined) step.text = outcome.text;
  return step;
}

function stopAfter(step: StepResult): StopReason | undefined {
  if (!step.ok) return 'failed';
  if (step.changes.dialog) return 'dialog';
  if (
    step.type === 'tab' ||
    step.changes.tabs_opened.length > 0 ||
    step.changes.tabs_closed.length > 0
  ) {
    return 'tab';
  }
  if (step.changes.navigated) return 'navigated';
  return undefined;
}

export async function hauntAct(
  manager: SessionManager,
  input: ActInput,
): Promise<ActResult> {
  const session = manager.get(input.session_id);
  await manager.reapStale(SESSION_TTL_MS);

  if (session.step_count >= session.max_steps) {
    throw new Error(
      `Session ${session.id} hit its step limit (${session.max_steps}). Call haunt_end_session instead of acting further.`,
    );
  }
  if (Date.now() - session.start_time > session.max_active_duration_ms) {
    throw new Error(
      `Session ${session.id} exceeded its active-duration cap (${session.max_active_duration_ms}ms). Call haunt_end_session instead of acting further.`,
    );
  }
  if (input.issues?.length) session.issues.push(...input.issues);

  const blockedBefore = session.sandbox_blocked_requests.length;
  // The state every later step, and the final diff, is measured against. The
  // previous snapshot serves if nothing has changed in the page since it was
  // taken, which spares reading a large page twice per action.
  const known = session.snapshot.previous;
  let current = false;
  if (
    known &&
    !session.runtime.dialog &&
    known.snapshot.url === session.page.url()
  ) {
    const ages = await Promise.all(
      session.page
        .frames()
        .map((frame) => withTimeout(frame.evaluate(sinceMutation), 500)),
    );
    const sinceRead = Date.now() - known.at;
    current = ages.every((age) => age !== undefined && age > sinceRead + 5);
  }
  if (!current) await takeSnapshot(session, { format: 'json' }, true);
  const before = new Map(session.snapshot.previous?.comparable ?? []);
  const textsBefore = [...(session.snapshot.previous?.texts ?? [])];

  const results: StepResult[] = [];
  let stopped: StopReason | undefined;
  for (let i = 0; i < input.actions.length; i++) {
    if (session.step_count >= session.max_steps) {
      stopped = 'step_limit';
      break;
    }
    session.step_count++;
    const step = await runStep(session, input.actions[i]);
    results.push(step);
    const reason = stopAfter(step);
    // Whatever stops a sequence only matters if something was left to run.
    if (reason && (reason === 'failed' || i < input.actions.length - 1)) {
      stopped = reason;
      break;
    }
  }

  const page = session.page;
  if (!page.isClosed()) session.pages_visited.push(page.url());
  const blocked = session.sandbox_blocked_requests.slice(blockedBefore);
  const result: ActResult = {
    results,
    executed: results.length,
    requested: input.actions.length,
    url: page.isClosed() ? '' : page.url(),
    title: session.runtime.dialog
      ? ''
      : ((await withTimeout(page.title(), 1_000)) ?? ''),
    diff: diffBetween(before, session.snapshot.previous?.elements ?? []),
    text_changes: textChanges(
      textsBefore,
      session.snapshot.previous?.texts ?? [],
    ),
    console_errors: session.console_errors.splice(0),
    network_errors: session.network_errors.splice(0),
    step: session.step_count,
    steps_remaining: session.max_steps - session.step_count,
  };
  if (stopped) result.stopped = stopped;
  if (blocked.length > 0) result.sandbox_blocked = blocked;
  return result;
}
