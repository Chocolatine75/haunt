// mcp-server/src/cli/providers/anthropic.ts
import type Anthropic from '@anthropic-ai/sdk';
import {
  type ActionDecider,
  DECIDE_ACTION_TOOL_DESCRIPTION,
  DECIDE_ACTION_TOOL_NAME,
  decideActionParameters,
  parseDecideActionInput,
} from './types.js';

export function createAnthropicDecider(
  client: Anthropic,
  model: string,
): ActionDecider {
  const tool: Anthropic.Tool = {
    name: DECIDE_ACTION_TOOL_NAME,
    description: DECIDE_ACTION_TOOL_DESCRIPTION,
    input_schema: decideActionParameters() as Anthropic.Tool['input_schema'],
  };

  return async (systemPrompt, stateDescription) => {
    const response = await client.messages.create({
      model,
      max_tokens: 4_096,
      output_config: { effort: 'low' },
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: 'tool', name: DECIDE_ACTION_TOOL_NAME },
      messages: [{ role: 'user', content: stateDescription }],
    });

    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!block) {
      throw new Error(
        `Model did not return a ${DECIDE_ACTION_TOOL_NAME} tool call (stop_reason: ${response.stop_reason})`,
      );
    }

    return parseDecideActionInput(block.input);
  };
}
