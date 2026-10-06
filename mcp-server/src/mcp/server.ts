import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// mcp-server/src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SCREENSHOTS_DIR } from '../engine/constants.js';
import { SessionManager } from '../engine/session/manager.js';
import { TOOLS, describeInputError, toolInputJsonSchema } from './tools.js';

// The manager can be supplied by a caller that needs to reach the sessions
// itself — the gate tests do, to read a page's real state behind the tools.
export function createServer(
  manager: SessionManager = new SessionManager(),
): Server {
  const server = new Server(
    { name: 'haunt', version: '0.2.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: toolInputJsonSchema(tool),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const parsed = tool.input.safeParse(args);
      if (!parsed.success) {
        throw new Error(describeInputError(name, parsed.error));
      }

      const result = await tool.run(manager, parsed.data);

      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [{ type: 'text', text: JSON.stringify(result, null, 2) }];
      // A screenshot asked for is shown, not only saved: a tester has no
      // other way to look at the page (R-T13), and a path it cannot open is
      // a picture nobody sees.
      const shot = (result as { screenshot_path?: string } | undefined)
        ?.screenshot_path;
      if (name === 'haunt_capture_state' && shot) {
        const path = join(SCREENSHOTS_DIR, shot);
        if (existsSync(path)) {
          content.push({
            type: 'image',
            data: readFileSync(path).toString('base64'),
            mimeType: 'image/png',
          });
        }
      }
      return { content };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
