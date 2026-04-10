// mcp-server/src/tools/end-session.ts
import type { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';

export interface EndSessionInput {
  session_id: string;
  overall_impression?: string;
}

export interface EndSessionOutput {
  session_id: string;
  persona: string;
  duration_seconds: number;
  pages_visited: number;
  step_count: number;
  issues_found: Issue[];
  overall_impression: string;
}

export async function hauntEndSession(
  manager: SessionManager,
  input: EndSessionInput,
): Promise<EndSessionOutput> {
  const session = manager.get(input.session_id);

  await session.browser.close();

  const duration_seconds = Math.round((Date.now() - session.start_time) / 1_000);

  const output: EndSessionOutput = {
    session_id: session.id,
    persona: session.persona.name,
    duration_seconds,
    pages_visited: session.pages_visited.length,
    step_count: session.step_count,
    issues_found: session.issues,
    overall_impression:
      input.overall_impression ??
      `Completed ${session.step_count} steps across ${session.pages_visited.length} pages.`,
  };

  manager.delete(input.session_id);

  return output;
}
