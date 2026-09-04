// mcp-server/src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from './session/manager.js';
import { hauntCaptureState } from './tools/capture.js';
import { hauntEndSession } from './tools/end-session.js';
import { hauntEstimateCost } from './tools/estimate-cost.js';
import { hauntGenerateReport } from './tools/generate-report.js';
import { hauntGetCookies } from './tools/get-cookies.js';
import { hauntNavigate } from './tools/navigate.js';
import { hauntSpawn } from './tools/spawn.js';

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
        description:
          'Open a browser session for a persona and navigate to the target URL. Returns persona details (name, goal, system prompt) so the orchestrator can roleplay as that persona.',
        inputSchema: {
          type: 'object',
          properties: {
            persona: {
              type: 'string',
              description:
                'Persona name (e.g. confused-beginner) or absolute path to a YAML file',
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
              description:
                'Maximum navigation steps for this session. Default: 30',
            },
            cookies: {
              type: 'array',
              description:
                'Session cookies to inject before navigation (for authenticated testing)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'string' },
                  domain: { type: 'string' },
                  path: { type: 'string' },
                  expires: { type: 'number' },
                  httpOnly: { type: 'boolean' },
                  secure: { type: 'boolean' },
                  sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'] },
                },
                required: ['name', 'value'],
              },
            },
          },
          required: ['persona', 'target_url'],
        },
      },
      {
        name: 'haunt_get_cookies',
        description:
          'Extract all cookies from the current browser session. Use after a successful login to capture the session cookies for reuse in authenticated test sessions.',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Session ID from haunt_spawn',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'haunt_navigate',
        description:
          'Execute a browser action decided by the orchestrator (as the persona). Actions: "click <target>", "fill <text> in <field>", "goto <url>", "press <key>".',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Session ID from haunt_spawn',
            },
            action: {
              type: 'string',
              description:
                'Action to perform, e.g. "click Login", "fill test@example.com in Email", "goto http://localhost:3000/about", "press Enter"',
            },
            issues: {
              type: 'array',
              description: 'Issues the orchestrator observed during this step',
              items: {
                type: 'object',
                properties: {
                  severity: {
                    type: 'string',
                    enum: ['critical', 'major', 'minor', 'suggestion'],
                  },
                  category: {
                    type: 'string',
                    enum: [
                      'ux',
                      'accessibility',
                      'performance',
                      'security',
                      'content',
                    ],
                  },
                  description: { type: 'string' },
                  page_url: { type: 'string' },
                  recommendation: { type: 'string' },
                },
                required: [
                  'severity',
                  'category',
                  'description',
                  'page_url',
                  'recommendation',
                ],
              },
            },
          },
          required: ['session_id', 'action'],
        },
      },
      {
        name: 'haunt_capture_state',
        description:
          'Capture the current page state: accessibility tree, optional screenshot, optional DOM. Call this before deciding each action.',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            include_screenshot: {
              type: 'boolean',
              description: 'Default: true',
            },
            include_dom: {
              type: 'boolean',
              description:
                'Include raw HTML snapshot (capped at 5000 chars). Default: false',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'haunt_end_session',
        description:
          'Close the browser session and return the structured report of all issues found.',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            overall_impression: {
              type: 'string',
              description:
                "The orchestrator's summary of the session from the persona's perspective",
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'haunt_estimate_cost',
        description:
          'Compute the browser-call cost estimate for a planned test run (route count × steps). Call before Phase 2 to print the "proceed?" confirmation.',
        inputSchema: {
          type: 'object',
          properties: {
            route_count: {
              type: 'number',
              description: 'Number of areas/routes in the page plan',
            },
            steps_per_route: {
              type: 'number',
              description: 'Max navigation steps per route (the --steps value)',
            },
          },
          required: ['route_count', 'steps_per_route'],
        },
      },
      {
        name: 'haunt_generate_report',
        description:
          'Compute issue counts, sort issues by severity, render the markdown report, and write it to .haunt-reports/. Returns the exact terminal summary to print. Call once in Phase 3 after all sessions have ended — do not hand-write the report file.',
        inputSchema: {
          type: 'object',
          properties: {
            target_url: { type: 'string' },
            personas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Persona names used in this run',
            },
            sessions: {
              type: 'array',
              description: 'One entry per ended session',
              items: {
                type: 'object',
                properties: {
                  area: {
                    type: 'string',
                    description:
                      'The route/area this session tested, e.g. /signup',
                  },
                  persona: { type: 'string' },
                  overall_impression: { type: 'string' },
                  issues: {
                    type: 'array',
                    description: "This session's EndSessionOutput.issues_found",
                    items: {
                      type: 'object',
                      properties: {
                        severity: {
                          type: 'string',
                          enum: ['critical', 'major', 'minor', 'suggestion'],
                        },
                        category: {
                          type: 'string',
                          enum: [
                            'ux',
                            'accessibility',
                            'performance',
                            'security',
                            'content',
                          ],
                        },
                        description: { type: 'string' },
                        page_url: { type: 'string' },
                        recommendation: { type: 'string' },
                      },
                      required: [
                        'severity',
                        'category',
                        'description',
                        'page_url',
                        'recommendation',
                      ],
                    },
                  },
                },
                required: ['area', 'persona', 'overall_impression', 'issues'],
              },
            },
            compare_with: {
              type: 'string',
              description:
                'Path to a previous report (its .md path, or the .json sidecar directly) to diff against. Annotates each current issue as new vs. still present, and lists issues from that run no longer found.',
            },
          },
          required: ['target_url', 'personas', 'sessions'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      let result: unknown;

      if (name === 'haunt_spawn') {
        result = await hauntSpawn(
          manager,
          args as unknown as Parameters<typeof hauntSpawn>[1],
        );
      } else if (name === 'haunt_navigate') {
        result = await hauntNavigate(
          manager,
          args as unknown as Parameters<typeof hauntNavigate>[1],
        );
      } else if (name === 'haunt_capture_state') {
        result = await hauntCaptureState(
          manager,
          args as unknown as Parameters<typeof hauntCaptureState>[1],
        );
      } else if (name === 'haunt_end_session') {
        result = await hauntEndSession(
          manager,
          args as unknown as Parameters<typeof hauntEndSession>[1],
        );
      } else if (name === 'haunt_get_cookies') {
        result = await hauntGetCookies(
          manager,
          args as unknown as Parameters<typeof hauntGetCookies>[1],
        );
      } else if (name === 'haunt_estimate_cost') {
        result = hauntEstimateCost(
          args as unknown as Parameters<typeof hauntEstimateCost>[0],
        );
      } else if (name === 'haunt_generate_report') {
        result = hauntGenerateReport(
          args as unknown as Parameters<typeof hauntGenerateReport>[0],
        );
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
