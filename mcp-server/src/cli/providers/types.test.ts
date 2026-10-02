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

  it.each([
    [{}],
    [{ actions: [] }],
    [{ actions: 'click e1' }],
    [{ issues: [] }],
  ])('rejects %j, which has nothing to execute', (input) => {
    expect(() => parseDecideActionInput(input)).toThrow(
      'decide_action tool call was missing "actions"',
    );
  });
});

describe('decideActionParameters', () => {
  it('requires only the actions, so a step with nothing to report is valid', () => {
    expect(decideActionParameters().required).toEqual(['actions']);
  });

  it('describes every action the engine accepts', () => {
    const schema = JSON.stringify(decideActionParameters());
    for (const type of ACTION_TYPES)
      expect(schema, type).toContain(`"${type}"`);
  });
});
