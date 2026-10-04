import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type HauntClient,
  connectInMemory,
} from '../test-support/mcp-client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_TOOLS = [
  'haunt_spawn',
  'haunt_get_cookies',
  'haunt_capture_state',
  'haunt_end_session',
  'haunt_estimate_cost',
  'haunt_generate_report',
  'haunt_act',
  'haunt_replay',
];

// Protocol-level tests that need no browser: what a host sees when it lists
// and calls haunt's tools.
describe('MCP server', () => {
  let haunt: HauntClient;

  beforeAll(async () => {
    haunt = await connectInMemory();
  });

  afterAll(async () => {
    await haunt.close();
  });

  it('identifies itself with the version from package.json', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'),
    );
    expect(haunt.client.getServerVersion()).toEqual({
      name: 'haunt',
      version: pkg.version,
    });
  });

  it('lists exactly the documented tools', async () => {
    const { tools } = await haunt.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('gives every tool a description and a self-consistent input schema', async () => {
    const { tools } = await haunt.client.listTools();
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.type, tool.name).toBe('object');
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      // A required field that isn't declared is a schema the host can't satisfy.
      for (const required of tool.inputSchema.required ?? []) {
        expect(properties, `${tool.name}.${required}`).toContain(required);
      }
    }
  });

  it('uses the same issue schema for haunt_act and haunt_generate_report', async () => {
    const { tools } = await haunt.client.listTools();
    const schemaOf = (name: string) =>
      tools.find((t) => t.name === name)?.inputSchema.properties as Record<
        string,
        // biome-ignore lint/suspicious/noExplicitAny: walking raw JSON Schema
        any
      >;
    const actIssue = schemaOf('haunt_act').issues.items;
    const reportIssue = schemaOf('haunt_generate_report').sessions.items
      .properties.issues.items;
    // The report also takes how haunt_end_session verified each one.
    const { verification, ...filed } = reportIssue.properties;
    expect(verification).toBeTruthy();
    expect({ ...reportIssue, properties: filed }).toEqual(actIssue);
  });

  it('returns a tool result as JSON text', async () => {
    const result = await haunt.call<{
      browser_calls: number;
      session_size: string;
    }>('haunt_estimate_cost', { route_count: 4, steps_per_route: 3 });

    expect(result.isError).toBe(false);
    expect(result.data.browser_calls).toBe(36);
    expect(result.data.session_size).toBe('heavy');
  });

  it('reports an unknown tool as an error result, not a protocol failure', async () => {
    const result = await haunt.call('haunt_does_not_exist');
    expect(result.isError).toBe(true);
    expect(result.text).toBe('Error: Unknown tool: haunt_does_not_exist');
  });

  it.each([
    ['haunt_act', { session_id: 'nope', actions: [{ type: 'reload' }] }],
    ['haunt_capture_state', { session_id: 'nope' }],
    ['haunt_get_cookies', { session_id: 'nope' }],
    ['haunt_end_session', { session_id: 'nope' }],
  ])('%s reports an unknown session as an error result', async (tool, args) => {
    const result = await haunt.call(tool, args);
    expect(result.isError).toBe(true);
    expect(result.text).toBe('Error: Session not found: nope');
  });

  it('reports a missing persona file as an error result without opening a browser', async () => {
    const result = await haunt.call('haunt_spawn', {
      persona: '/nonexistent/persona.yaml',
      target_url: 'data:text/html,<h1>x</h1>',
    });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/ENOENT/);
  });

  describe('argument validation', () => {
    it('names a missing required argument instead of failing inside the engine', async () => {
      const result = await haunt.call('haunt_spawn', {
        target_url: 'data:text/html,<h1>x</h1>',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toBe(
        'Error: Invalid arguments for haunt_spawn: persona: Required',
      );
    });

    it('rejects an argument of the wrong type', async () => {
      const result = await haunt.call('haunt_estimate_cost', {
        route_count: 'four',
        steps_per_route: 3,
      });
      expect(result.isError).toBe(true);
      expect(result.text).toContain(
        'Invalid arguments for haunt_estimate_cost: route_count: Expected number',
      );
    });

    it('reports every invalid argument, with its path, in one message', async () => {
      const result = await haunt.call('haunt_generate_report', {
        target_url: 'http://localhost:3000',
        personas: ['p'],
        sessions: [
          {
            area: '/',
            persona: 'p',
            overall_impression: 'ok',
            issues: [{ severity: 'catastrophic', category: 'ux' }],
          },
        ],
      });
      expect(result.isError).toBe(true);
      expect(result.text).toContain('sessions.0.issues.0.severity: ');
      expect(result.text).toContain(
        'sessions.0.issues.0.description: Required',
      );
    });

    it('rejects an issue with an unknown severity before it reaches a session', async () => {
      const result = await haunt.call('haunt_act', {
        session_id: 'nope',
        actions: [{ type: 'reload' }],
        issues: [
          {
            severity: 'blocker',
            category: 'ux',
            description: 'd',
            page_url: '/',
            recommendation: 'r',
          },
        ],
      });
      expect(result.isError).toBe(true);
      // Validation runs first: the error is about the argument, not the session.
      expect(result.text).toContain('issues.0.severity');
    });

    it('ignores arguments the tool does not declare', async () => {
      const result = await haunt.call<{ browser_calls: number }>(
        'haunt_estimate_cost',
        { route_count: 1, steps_per_route: 1, surprise: true },
      );
      expect(result.isError).toBe(false);
      expect(result.data.browser_calls).toBe(5);
    });

    it('accepts a cookie given only a name and a value', async () => {
      const { tools } = await haunt.client.listTools();
      const spawn = tools.find((t) => t.name === 'haunt_spawn');
      // biome-ignore lint/suspicious/noExplicitAny: walking raw JSON Schema
      const cookie = (spawn?.inputSchema.properties as any).cookies.items;
      expect(cookie.required).toEqual(['name', 'value']);
    });
  });

  it('keeps sessions isolated between server instances', async () => {
    const other = await connectInMemory();
    try {
      const result = await other.call('haunt_end_session', {
        session_id: 'nope',
      });
      expect(result.isError).toBe(true);
    } finally {
      await other.close();
    }
  });
});
