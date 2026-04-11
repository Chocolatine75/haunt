// mcp-server/src/tools/get-cookies.ts
import type { SessionManager } from '../session/manager.js';

export interface GetCookiesInput {
  session_id: string;
}

export interface GetCookiesOutput {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None' | undefined;
  }>;
}

export async function hauntGetCookies(
  manager: SessionManager,
  input: GetCookiesInput,
): Promise<GetCookiesOutput> {
  const session = manager.get(input.session_id);
  const cookies = await session.page.context().cookies();
  return { cookies };
}
