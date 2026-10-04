import { describe, expect, it } from 'vitest';
import type {
  SnapshotContainer,
  SnapshotElement,
} from '../../gates/part-1/contract.js';
import { locatorOf, newRecording, record, refFor } from './recording.js';

const el = (
  ref: string,
  role: string,
  name: string,
  path: string[] = [],
): SnapshotElement => ({ ref, role, name, tag: 'button', path });

const CONTAINERS: SnapshotContainer[] = [
  { id: 'f1', kind: 'frame', path: [], url: 'http://a.test/frame/quote?x=1' },
  { id: 's1', kind: 'shadow', path: [], mode: 'open' },
];

describe('locators', () => {
  const elements = [
    el('e1', 'button', 'Save'),
    el('e2', 'button', 'Save'),
    el('e3', 'button', 'Save', ['f1']),
    el('e4', 'button', 'Apply', ['s1']),
  ];

  it('tell apart elements of the same role and name by their index and path', () => {
    expect(locatorOf(elements, CONTAINERS, 'e2')).toEqual({
      role: 'button',
      name: 'Save',
      index: 1,
      path: [],
    });
    expect(locatorOf(elements, CONTAINERS, 'e3')).toEqual({
      role: 'button',
      name: 'Save',
      index: 0,
      path: [{ frame: '/frame/quote', index: 0 }],
    });
    expect(locatorOf(elements, CONTAINERS, 'e4')?.path).toEqual([
      { shadow: 0 },
    ]);
    expect(locatorOf(elements, CONTAINERS, 'e99')).toBeUndefined();
  });

  it('find the same element in another session, numbered differently', () => {
    const other = [
      el('e10', 'button', 'Save'),
      el('e11', 'button', 'Save'),
      el('e12', 'button', 'Save', ['f7']),
    ];
    const containers: SnapshotContainer[] = [
      { id: 'f7', kind: 'frame', path: [], url: 'http://b.test/frame/quote' },
    ];
    for (const [ref, found] of [
      ['e2', 'e11'],
      ['e3', 'e12'],
    ]) {
      const locator = locatorOf(elements, CONTAINERS, ref);
      if (!locator) throw new Error(`no locator for ${ref}`);
      expect(refFor(other, containers, locator)).toBe(found);
    }
    // Gone from the other page: nothing, never a neighbour.
    const apply = locatorOf(elements, CONTAINERS, 'e4');
    if (!apply) throw new Error('no locator');
    expect(refFor(other, containers, apply)).toBeUndefined();
  });
});

describe('record', () => {
  it('keeps no reference and no typed secret, and numbers the secrets', () => {
    const recording = newRecording(
      'http://a.test/',
      { width: 800, height: 600 },
      { persona: 'p', cookies: [{ name: 'c', value: 'v' }] },
    );
    expect(recording.spawn).toEqual({ persona: 'p' });
    const locator = { role: 'textbox', name: 'Password', index: 0, path: [] };
    record(
      recording,
      1,
      { type: 'fill', ref: 'e5', text: 'hunter22' },
      { ref: locator },
      true,
    );
    record(
      recording,
      2,
      { type: 'fill', ref: 'e6', text: 'hunter22' },
      { ref: locator },
      true,
    );
    record(
      recording,
      3,
      { type: 'fill', ref: 'e7', text: 'Ada' },
      { ref: locator },
      false,
    );
    expect(recording.steps.map((s) => s.action)).toEqual([
      { type: 'fill', ref: '@ref', text: '{{secret:1}}' },
      { type: 'fill', ref: '@ref', text: '{{secret:1}}' },
      { type: 'fill', ref: '@ref', text: 'Ada' },
    ]);
    expect([...recording.secrets.values()]).toEqual(['{{secret:1}}']);
  });
});
