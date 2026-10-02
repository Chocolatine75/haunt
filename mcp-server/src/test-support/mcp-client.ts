// Connects a real MCP client to a haunt server so tests go through the same
// JSON-RPC surface a host (Claude Code) uses — tool listing, argument passing,
// JSON-in-text results and isError — instead of calling the tool functions
// directly.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { SessionManager } from '../engine/session/manager.js';
import { createServer } from '../mcp/server.js';

export interface ToolCallResult<T> {
  isError: boolean;
  // Raw text of the first content block (the error message when isError).
  text: string;
  // Parsed JSON payload; undefined when isError.
  data: T;
}

export interface HauntClient {
  client: Client;
  call<T = Record<string, unknown>>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<ToolCallResult<T>>;
  close(): Promise<void>;
}

export async function wrapClient(transport: Transport): Promise<HauntClient> {
  const client = new Client({ name: 'haunt-tests', version: '0.0.0' });
  await client.connect(transport);

  return {
    client,
    async call<T>(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as Array<{ type: string; text: string }>;
      const text = content[0]?.text ?? '';
      const isError = result.isError === true;
      return {
        isError,
        text,
        data: (isError ? undefined : JSON.parse(text)) as T,
      };
    },
    close: () => client.close(),
  };
}

// In-process server built from src/ — no child process, no build step.
export async function connectInMemory(
  manager?: SessionManager,
): Promise<HauntClient> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await createServer(manager).connect(serverTransport);
  return wrapClient(clientTransport);
}
