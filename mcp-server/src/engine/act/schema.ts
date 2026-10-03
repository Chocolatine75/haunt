// mcp-server/src/engine/act/schema.ts
//
// The one definition of what an action is. The JSON Schema a host sees for
// haunt_act is generated from it, and every action is checked against it
// before it runs, so a malformed action fails as a step with the offending
// parameter named instead of somewhere inside Playwright.
import { z } from 'zod';
import type { Action } from '../../gates/part-1/contract.js';

const ref = z
  .string()
  .describe('Element reference from the snapshot, e.g. "e12"');

const actions = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    ref,
    button: z.enum(['left', 'right', 'middle']).optional(),
    count: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional()
      .describe('2 for a double click'),
    modifiers: z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift'])).optional(),
  }),
  z.object({
    type: z.literal('fill'),
    ref,
    text: z.string().describe('The value, taken literally'),
    clear: z
      .boolean()
      .optional()
      .describe('Replace what is there. Default: true'),
    submit: z.boolean().optional().describe('Press Enter afterwards'),
  }),
  z.object({
    type: z.literal('type'),
    ref: ref.optional().describe('Defaults to the focused element'),
    text: z
      .string()
      .describe('Typed key by key, for fields that react to keystrokes'),
    delay_ms: z.number().min(0).optional(),
  }),
  z.object({
    type: z.literal('press'),
    keys: z
      .union([z.string(), z.array(z.string()).min(1)])
      .describe('"Enter", "Control+A", or a list pressed in order'),
    ref: ref.optional(),
  }),
  z.object({
    type: z.literal('select'),
    ref,
    values: z
      .array(z.string())
      .min(1)
      .describe('Option labels or values of a native select'),
  }),
  z.object({ type: z.literal('options'), ref }),
  z.object({
    type: z.literal('check'),
    ref,
    checked: z
      .boolean()
      .describe('The state to end in; nothing happens if it is already there'),
  }),
  z.object({ type: z.literal('hover'), ref }),
  z.object({
    type: z.literal('scroll'),
    direction: z.enum(['up', 'down', 'left', 'right']),
    amount: z
      .number()
      .positive()
      .optional()
      .describe('Pixels. Default: one page'),
    ref: ref.optional().describe('A scroll container. Default: the page'),
  }),
  z.object({
    type: z.literal('scroll_to'),
    ref: ref.optional(),
    text: z
      .string()
      .optional()
      .describe('Scroll to the first place this text appears'),
  }),
  z.object({
    type: z.literal('drag'),
    from_ref: ref,
    to_ref: ref.optional(),
    offset: z
      .object({ x: z.number(), y: z.number() })
      .optional()
      .describe(
        'Pixels from the centre of to_ref, or of from_ref when there is no to_ref',
      ),
  }),
  z.object({
    type: z.literal('upload'),
    ref,
    files: z.array(z.string()).min(1).describe('Absolute paths'),
  }),
  z.object({ type: z.literal('goto'), url: z.string() }),
  z.object({ type: z.literal('back') }),
  z.object({ type: z.literal('forward') }),
  z.object({ type: z.literal('reload') }),
  z.object({
    type: z.literal('wait_for'),
    text: z.string().optional().describe('Until this text is visible'),
    ref: ref.optional().describe('Until this element is visible'),
    gone: z.string().optional().describe('Until this text is no longer there'),
    url: z.string().optional().describe('Until the URL contains this'),
    ms: z.number().min(0).max(60_000).optional().describe('A fixed pause'),
    timeout_ms: z.number().positive().max(60_000).optional(),
  }),
  z.object({
    type: z.literal('tab'),
    op: z.enum(['switch', 'close', 'new']),
    index: z.number().int().min(0).optional(),
    url: z.string().optional(),
  }),
  z.object({
    type: z.literal('dialog'),
    accept: z.boolean(),
    text: z.string().optional().describe('What to enter in a prompt'),
  }),
  z.object({
    type: z.literal('resize'),
    width: z.number().int().min(200).max(4000),
    height: z.number().int().min(200).max(4000),
  }),
  z.object({ type: z.literal('read'), ref: ref.optional() }),
]);

export const actionSchema = actions.superRefine((action, ctx) => {
  const missing = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (action.type === 'wait_for') {
    const { text, ref: r, gone, url, ms } = action;
    if ([text, r, gone, url, ms].every((v) => v === undefined)) {
      missing('text', 'wait_for needs one of text, ref, gone, url or ms');
    }
  }
  if (
    action.type === 'tab' &&
    action.op !== 'new' &&
    action.index === undefined
  ) {
    missing('index', `tab ${action.op} needs an index`);
  }
  if (
    action.type === 'scroll_to' &&
    action.ref === undefined &&
    action.text === undefined
  ) {
    missing('ref', 'scroll_to needs a ref or a text');
  }
  if (
    action.type === 'drag' &&
    action.to_ref === undefined &&
    action.offset === undefined
  ) {
    missing('to_ref', 'drag needs a to_ref or an offset');
  }
});

export type ValidatedAction = z.infer<typeof actions>;

// The schema's shape and the contract's must be the same thing.
const _same: Action = {} as ValidatedAction;
const _back: ValidatedAction = {} as Action;
void _same;
void _back;

export type Validation =
  | { ok: true; action: ValidatedAction }
  | { ok: false; parameter: string; message: string };

export function validateAction(input: unknown): Validation {
  if (typeof input !== 'object' || input === null) {
    return {
      ok: false,
      parameter: 'type',
      message: `An action is an object such as {"type": "click", "ref": "e12"}; got ${JSON.stringify(input)}.`,
    };
  }
  const parsed = actionSchema.safeParse(input);
  if (parsed.success) return { ok: true, action: parsed.data };
  const issue = parsed.error.issues[0];
  const parameter = String(issue.path[0] ?? 'type');
  const type = (input as { type?: unknown })?.type;
  const message =
    parameter === 'type'
      ? `Unknown action type ${JSON.stringify(type)}.`
      : `Invalid ${JSON.stringify(parameter)} for ${String(type)}: ${issue.message}.`;
  return { ok: false, parameter, message };
}
