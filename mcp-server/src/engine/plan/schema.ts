// mcp-server/src/engine/plan/schema.ts
//
// What a tester sends about its plan, as zod schemas: defined once, for the
// MCP tools (mcp/tools.ts) and for the answer haunt-ci asks of a model
// (cli/providers/types.ts).
import { z } from 'zod';
import { CASE_KINDS } from '../../gates/part-4/contract.js';
import { malformed } from './expect.js';

// What a tester expects of the page (part 4, R-T7 … R-T9): part 3's
// observations, a list read exactly, or the state of a control.
export const listQuerySchema = z.object({
  within: z
    .object({ role: z.string(), name: z.string() })
    .describe(
      'The container, by its role and accessible name: { role: "list", name: "Results" }',
    ),
  items: z
    .string()
    .describe(
      'The role of the items read under it, in reading order: listitem, heading, row, img…',
    ),
});

export const expectationSchema = z
  .object({
    text_present: z.string().optional(),
    text_absent: z.string().optional(),
    url: z.string().optional(),
    element: z
      .object({
        ref: z.string(),
        state: z.enum(['visible', 'hidden', 'disabled', 'enabled', 'gone']),
      })
      .optional(),
    list: listQuerySchema
      .extend({
        count: z
          .object({
            eq: z.number().int().optional(),
            min: z.number().int().optional(),
            max: z.number().int().optional(),
          })
          .optional(),
        every_contains: z.string().optional(),
        none_contains: z.string().optional(),
        order: z.enum(['ascending', 'descending']).optional(),
        as: z
          .enum(['number', 'text'])
          .optional()
          .describe(
            'How the order is judged; a number is the first one written in the item. Default: text',
          ),
        equals: z
          .array(z.string())
          .optional()
          .describe('Exactly these items, in this order'),
      })
      .optional()
      .describe(
        'The items of a container, as the page shows them, and what must be true of them',
      ),
    value: z
      .object({
        ref: z.string(),
        of: z.enum(['value', 'checked', 'expanded', 'pressed', 'focused']),
        is: z.union([z.string(), z.boolean()]),
      })
      .optional()
      .describe(
        'What a control holds or its state. A credential field reads as "(filled)" or "(empty)"',
      ),
    step: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'For an issue: the step after which it holds. Default: the last step',
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const problem = malformed(value);
    if (problem)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

export const planCaseSchema = z.object({
  id: z.string().min(1).describe('A short name of your own: "titles-only"'),
  kind: z
    .enum(CASE_KINDS)
    .describe(
      'normal use, an edge input, a state change, keyboard only, visual, or hostile (attack payloads; only in a session spawned with hostile: true)',
    ),
  controls: z
    .array(
      z.union([
        z.string(),
        z.object({
          role: z.string(),
          name: z.string(),
          group: z.string(),
          index: z.number().int().min(0).optional(),
        }),
      ]),
    )
    .describe(
      'The controls it exercises: references from the inventory, or what each is ({ role, name, group }), as `portable` gives them, to register in this session a plan made in another',
    ),
  expect: z
    .string()
    .describe('One sentence: what should be true once the case is played'),
});
