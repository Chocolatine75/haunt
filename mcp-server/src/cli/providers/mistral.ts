// mcp-server/src/cli/providers/mistral.ts
import type { Mistral } from '@mistralai/mistralai';
import type { ChatCompletionRequestTool } from '@mistralai/mistralai/models/components';
import {
  type ActionDecider,
  DECIDE_ACTION_TOOL_DESCRIPTION,
  DECIDE_ACTION_TOOL_NAME,
  decideActionParameters,
  parseDecideActionInput,
} from './types.js';

export function createMistralDecider(
  client: Mistral,
  model: string,
): ActionDecider {
  const tool: ChatCompletionRequestTool = {
    type: 'function',
    function: {
      name: DECIDE_ACTION_TOOL_NAME,
      description: DECIDE_ACTION_TOOL_DESCRIPTION,
      parameters: decideActionParameters(),
    },
  };

  return async (systemPrompt, stateDescription) => {
    const response = await client.chat.complete({
      model,
      tools: [tool],
      toolChoice: {
        type: 'function',
        function: { name: DECIDE_ACTION_TOOL_NAME },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: stateDescription },
      ],
    });

    const toolCall = response.choices[0]?.message?.toolCalls?.[0];
    if (!toolCall) {
      throw new Error(
        `Model did not return a ${DECIDE_ACTION_TOOL_NAME} tool call (finish_reason: ${response.choices[0]?.finishReason})`,
      );
    }

    const rawArgs = toolCall.function.arguments;
    const input = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    return parseDecideActionInput(input);
  };
}
