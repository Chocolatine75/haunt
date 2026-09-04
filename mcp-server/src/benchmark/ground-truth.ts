import { readFileSync } from 'node:fs';
import type { IssueCategory } from '../types.js';

export interface GroundTruthBug {
  id: string;
  route: string;
  description: string;
  category: IssueCategory;
}

export function loadGroundTruth(path: string): GroundTruthBug[] {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `${path} does not contain a JSON array of ground-truth bugs`,
    );
  }
  return parsed as GroundTruthBug[];
}
