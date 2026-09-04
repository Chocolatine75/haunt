import type Anthropic from '@anthropic-ai/sdk';
import {
  buildJudgePrompt,
  parseScoreReportInput,
  type ReportJudge,
  SCORE_REPORT_TOOL_DESCRIPTION,
  SCORE_REPORT_TOOL_NAME,
  scoreReportParameters,
} from './types.js';

export function createAnthropicJudge(
  client: Anthropic,
  model: string,
): ReportJudge {
  const tool: Anthropic.Tool = {
    name: SCORE_REPORT_TOOL_NAME,
    description: SCORE_REPORT_TOOL_DESCRIPTION,
    input_schema: scoreReportParameters() as Anthropic.Tool['input_schema'],
  };

  return async (groundTruth, issues) => {
    // No effort override here (unlike decideAction's effort: 'low') — judging
    // is a one-time-per-run semantic call, not a high-volume repetitive one,
    // so it gets the model's default reasoning depth.
    const response = await client.messages.create({
      model,
      max_tokens: 4_096,
      tools: [tool],
      tool_choice: { type: 'tool', name: SCORE_REPORT_TOOL_NAME },
      messages: [
        { role: 'user', content: buildJudgePrompt(groundTruth, issues) },
      ],
    });

    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!block) {
      throw new Error(
        `Model did not return a ${SCORE_REPORT_TOOL_NAME} tool call (stop_reason: ${response.stop_reason})`,
      );
    }

    return parseScoreReportInput(block.input);
  };
}
