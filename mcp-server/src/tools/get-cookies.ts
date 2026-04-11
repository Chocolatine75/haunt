// mcp-server/src/tools/get-cookies.ts
import type { Cookie } from 'playwright';
import type { SessionManager } from '../session/manager.js';

export interface GetCookiesInput {
  session_id: string;
}

export interface GetCookiesOutput {
  cookies: Cookie[];
}

export async function hauntGetCookies(
  manager: SessionManager,
  input: GetCookiesInput,
): Promise<GetCookiesOutput> {
  const session = manager.get(input.session_id);
  const raw = await session.page.context().cookies();
  // Normalize sameSite: undefined → 'None' so cookies round-trip cleanly into haunt_spawn
  const cookies: Cookie[] = raw.map((c) => ({
    ...c,
    sameSite: c.sameSite ?? 'None',
  }));
  return { cookies };
}
