// mcp-server/src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from './session/manager.js';
import { hauntSpawn } from './tools/spawn.js';
import { hauntNavigate } from './tools/navigate.js';
import { hauntCaptureState } from './tools/capture.js';
import { hauntEndSession } from './tools/end-session.js';

export function createServer(): Server {
  const manager = new SessionManager();

  const server = new Server(
    { name: 'haunt', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'haunt_spawn',
        description: 'Create and initialize a phantom browser session for a persona',
        inputSchema: {
          type: 'object',
          properties: {
            persona: {
              type: 'string',
              description: 'Persona name (e.g. confused-beginner) or absolute path to a YAML file',
            },
            target_url: {
              type: 'string',
              description: 'URL to test (e.g. http://localhost:3000)',
            },
            headless: {
              type: 'boolean',
              description: 'Run browser in headless mode. Default: true',
            },
            timeout: {
              type: 'number',
              description: 'Maximum navigation steps for this session. Default: 30',
            },
          },
          required: ['persona', 'target_url'],
        },
      },
      {
        name: 'haunt_navigate',
        description:
          'Execute one navigation step: phantom reasons via Haiku, Stagehand executes in browser',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string', description: 'Session ID from haunt_spawn' },
            think_aloud: {
              type: 'boolean',
              description: "Include the phantom's internal reasoning in the output",
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'haunt_capture_state',
        description:
          'Capture a snapshot of the current page (screenshot, accessibility tree, DOM)',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            include_screenshot: { type: 'boolean', description: 'Default: true' },
            include_dom: { type: 'boolean', description: 'Include raw HTML snapshot (capped at 5000 chars). Default: false' },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'haunt_end_session',
        description:
          'Close the phantom session and return the structured report of all issues found',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
          },
          required: ['session_id'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      let result: unknown;

      if (name === 'haunt_spawn') {
        result = await hauntSpawn(manager, args as Parameters<typeof hauntSpawn>[1]);
      } else if (name === 'haunt_navigate') {
        result = await hauntNavigate(manager, args as Parameters<typeof hauntNavigate>[1]);
      } else if (name === 'haunt_capture_state') {
        result = await hauntCaptureState(manager, args as Parameters<typeof hauntCaptureState>[1]);
      } else if (name === 'haunt_end_session') {
        result = await hauntEndSession(manager, args as Parameters<typeof hauntEndSession>[1]);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
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
