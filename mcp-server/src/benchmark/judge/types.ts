import type { Issue } from '../../engine/types.js';
import type { GroundTruthBug } from '../ground-truth.js';

export interface JudgeMatch {
  ground_truth_id: string;
  matched_issue_description: string;
}

export interface JudgeVerdict {
  matched: JudgeMatch[];
  missed_ground_truth_ids: string[];
  false_positives: Array<{ description: string; reason: string }>;
  actionable_count: number;
  reasoning: string;
}

// One call: given the ground-truth bugs and a report's reported issues, score
// the report. Mirrors cli/providers/types.ts's ActionDecider shape.
export type ReportJudge = (
  groundTruth: GroundTruthBug[],
  issues: Issue[],
) => Promise<JudgeVerdict>;

export const SCORE_REPORT_TOOL_NAME = 'score_report';

export const SCORE_REPORT_TOOL_DESCRIPTION =
  'Score a haunt bug report against a list of known, ground-truth bugs: which ground-truth bugs a reported issue actually corresponds to, which reported issues are false positives (including tooling artifacts — e.g. a failed click misreported as an app bug, not a real product issue), and how many of the reported issues have a concrete, actionable fix recommendation rather than a vague one.';

export function scoreReportParameters(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      matched: {
        type: 'array',
        description:
          'Ground-truth bugs that a reported issue actually corresponds to',
        items: {
          type: 'object',
          properties: {
            ground_truth_id: { type: 'string' },
            matched_issue_description: {
              type: 'string',
              description:
                'The description of the reported issue that matches this ground-truth bug',
            },
          },
          required: ['ground_truth_id', 'matched_issue_description'],
        },
      },
      missed_ground_truth_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'IDs of ground-truth bugs that no reported issue corresponds to',
      },
      false_positives: {
        type: 'array',
        description:
          'Reported issues that do not correspond to any real, ground-truth bug',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['description', 'reason'],
        },
      },
      actionable_count: {
        type: 'number',
        description:
          'How many of the TOTAL reported issues (not just matched ones) have a concrete, actionable fix recommendation',
      },
      reasoning: {
        type: 'string',
        description:
          'One paragraph explaining the scoring, for a human to sanity-check',
      },
    },
    required: [
      'matched',
      'missed_ground_truth_ids',
      'false_positives',
      'actionable_count',
      'reasoning',
    ],
  };
}

export function buildJudgePrompt(
  groundTruth: GroundTruthBug[],
  issues: Issue[],
): string {
  return [
    'Ground-truth bugs known to exist in the app:',
    JSON.stringify(groundTruth, null, 2),
    '',
    'Issues reported in the haunt test report being scored:',
    JSON.stringify(issues, null, 2),
    '',
    'Score this report by calling score_report.',
  ].join('\n');
}

export function parseScoreReportInput(input: unknown): JudgeVerdict {
  const parsed = input as Partial<JudgeVerdict>;
  if (
    !Array.isArray(parsed.matched) ||
    !Array.isArray(parsed.missed_ground_truth_ids) ||
    !Array.isArray(parsed.false_positives) ||
    typeof parsed.actionable_count !== 'number' ||
    typeof parsed.reasoning !== 'string'
  ) {
    throw new Error(
      `${SCORE_REPORT_TOOL_NAME} tool call was missing one or more required fields`,
    );
  }
  return {
    matched: parsed.matched,
    missed_ground_truth_ids: parsed.missed_ground_truth_ids,
    false_positives: parsed.false_positives,
    actionable_count: parsed.actionable_count,
    reasoning: parsed.reasoning,
  };
}
