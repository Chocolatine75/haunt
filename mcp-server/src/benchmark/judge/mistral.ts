import type { Mistral } from '@mistralai/mistralai';
import type { ChatCompletionRequestTool } from '@mistralai/mistralai/models/components';
import {
  buildJudgePrompt,
  parseScoreReportInput,
  type ReportJudge,
  SCORE_REPORT_TOOL_DESCRIPTION,
  SCORE_REPORT_TOOL_NAME,
  scoreReportParameters,
} from './types.js';

export function createMistralJudge(
  client: Mistral,
  model: string,
): ReportJudge {
  const tool: ChatCompletionRequestTool = {
    type: 'function',
    function: {
      name: SCORE_REPORT_TOOL_NAME,
      description: SCORE_REPORT_TOOL_DESCRIPTION,
      parameters: scoreReportParameters(),
    },
  };

  return async (groundTruth, issues) => {
    const response = await client.chat.complete({
      model,
      tools: [tool],
      toolChoice: {
        type: 'function',
        function: { name: SCORE_REPORT_TOOL_NAME },
      },
      messages: [
        { role: 'user', content: buildJudgePrompt(groundTruth, issues) },
      ],
    });

    const toolCall = response.choices[0]?.message?.toolCalls?.[0];
    if (!toolCall) {
      throw new Error(
        `Model did not return a ${SCORE_REPORT_TOOL_NAME} tool call (finish_reason: ${response.choices[0]?.finishReason})`,
      );
    }

    const rawArgs = toolCall.function.arguments;
    const input = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    return parseScoreReportInput(input);
  };
}
