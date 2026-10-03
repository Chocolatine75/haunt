import { describe, expect, it } from 'vitest';
import { ACTION_TYPES } from '../../gates/part-1/contract.js';
import {
  MAX_ACTIONS_PER_STEP,
  decideActionParameters,
  parseDecideActionInput,
} from './types.js';

describe('parseDecideActionInput', () => {
  const click = { type: 'click' as const, ref: 'e1' };

  it('returns the actions and the issues', () => {
    const issue = {
      severity: 'minor' as const,
      category: 'ux' as const,
      description: 'd',
      page_url: '/',
      recommendation: 'r',
    };
    expect(
      parseDecideActionInput({ actions: [click], issues: [issue] }),
    ).toEqual({ actions: [click], issues: [issue] });
  });

  it('defaults issues to an empty list', () => {
    expect(parseDecideActionInput({ actions: [click] })).toEqual({
      actions: [click],
      issues: [],
    });
  });

  it('keeps at most five actions of one decision', () => {
    const many = Array.from({ length: 9 }, () => click);
    expect(parseDecideActionInput({ actions: many }).actions).toHaveLength(
      MAX_ACTIONS_PER_STEP,
    );
  });

  it.each([[{}], [{ actions: [] }], [{ actions: 'click e1' }], [null]])(
    'treats %j as a decision to do nothing',
    (input) => {
      expect(parseDecideActionInput(input)).toEqual({
        actions: [],
        issues: [],
      });
    },
  );
});

describe('decideActionParameters', () => {
  it('requires nothing, so that "nothing more to do" is a valid answer', () => {
    expect(decideActionParameters().required).toEqual([]);
  });

  it('describes every action the engine accepts', () => {
    const schema = JSON.stringify(decideActionParameters());
    for (const type of ACTION_TYPES)
      expect(schema, type).toContain(`"${type}"`);
  });
});
