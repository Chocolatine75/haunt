import { describe, expect, it } from 'vitest';
import { decideActionParameters, parseDecideActionInput } from './types.js';

describe('parseDecideActionInput', () => {
  it('returns the action and its issues', () => {
    const issue = {
      severity: 'minor' as const,
      category: 'ux' as const,
      description: 'd',
      page_url: '/',
      recommendation: 'r',
    };
    expect(
      parseDecideActionInput({ action: 'click Login', issues: [issue] }),
    ).toEqual({ action: 'click Login', issues: [issue] });
  });

  it('defaults issues to an empty list', () => {
    expect(parseDecideActionInput({ action: 'press Enter' })).toEqual({
      action: 'press Enter',
      issues: [],
    });
  });

  it.each([[{}], [{ action: '' }], [{ issues: [] }]])(
    'rejects %j, which has no action to execute',
    (input) => {
      expect(() => parseDecideActionInput(input)).toThrow(
        'decide_action tool call was missing "action"',
      );
    },
  );
});

describe('decideActionParameters', () => {
  it('requires only the action, so a step with nothing to report is valid', () => {
    expect(decideActionParameters().required).toEqual(['action']);
  });
});
