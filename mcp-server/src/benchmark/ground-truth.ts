import { readFileSync } from 'node:fs';
import type { IssueCategory } from '../engine/types.js';

export interface GroundTruthBug {
  id: string;
  route: string;
  description: string;
  category: IssueCategory;
}

const VALID_CATEGORIES: readonly IssueCategory[] = [
  'ux',
  'accessibility',
  'performance',
  'security',
  'content',
];

function findInvalidField(entry: unknown): string | undefined {
  if (typeof entry !== 'object' || entry === null) {
    return 'entry';
  }
  const candidate = entry as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return 'id';
  }
  if (typeof candidate.route !== 'string') {
    return 'route';
  }
  if (
    typeof candidate.description !== 'string' ||
    candidate.description.length === 0
  ) {
    return 'description';
  }
  if (
    typeof candidate.category !== 'string' ||
    !(VALID_CATEGORIES as readonly string[]).includes(candidate.category)
  ) {
    return 'category';
  }
  return undefined;
}

export function loadGroundTruth(path: string): GroundTruthBug[] {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `${path} does not contain a JSON array of ground-truth bugs`,
    );
  }
  for (let i = 0; i < parsed.length; i++) {
    const invalidField = findInvalidField(parsed[i]);
    if (invalidField) {
      throw new Error(
        `${path}: entry at index ${i} is missing or has an invalid "${invalidField}"`,
      );
    }
  }
  return parsed as GroundTruthBug[];
}
