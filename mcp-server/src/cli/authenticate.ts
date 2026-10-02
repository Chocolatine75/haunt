// mcp-server/src/cli/authenticate.ts
//
// Deterministic login flow for haunt-ci / haunt-benchmark, mirroring
// commands/haunt-test.md's interactive Phase 0.5 but with no LLM call: fill
// email, fill password, click a submit button, then extract cookies to pass
// into every persona session's haunt_spawn. No LLM reasoning is needed here
// because the flow is fixed (fill, fill, click) — only the button's visible
// text varies across apps, so a short list of common labels is tried in turn.
import type { Cookie } from 'playwright';
import { hauntCaptureState } from '../engine/capture.js';
import { hauntEndSession } from '../engine/end-session.js';
import { hauntGetCookies } from '../engine/get-cookies.js';
import { hauntNavigate } from '../engine/navigate.js';
import type { SessionManager } from '../engine/session/manager.js';
import { hauntSpawn } from '../engine/spawn.js';

export interface AuthenticateOptions {
  loginUrl: string;
  email: string;
  password: string;
  headless: boolean;
  // Only used for its browser/viewport defaults — the login flow itself is
  // deterministic, not persona-reasoned. Defaults to 'confused-beginner';
  // overridable so tests can point at a fixture persona.
  persona?: string;
}

const SUBMIT_BUTTON_LABELS = ['Log in', 'Sign in', 'Login', 'Submit'];

// A click that arrives before client-side hydration finishes falls through to
// the browser's native (unhandled) form submission — a full-page GET reload
// that wipes the just-filled fields instead of running the app's JS submit
// handler. A pause before filling (and another after submitting, for the
// async auth round-trip) is the simplest way to dodge that race without
// touching navigate.ts's general click behavior. Dev servers compile routes
// on demand, so how long this actually takes varies — retrying the whole
// fill/submit sequence a couple of times is cheaper than guessing a single
// pause long enough to never be wrong.
const HYDRATION_PAUSE_MS = 2_000;
const POST_SUBMIT_PAUSE_MS = 2_500;
const MAX_ATTEMPTS = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Compares by origin+pathname (ignoring query string) so a failed-login
// redirect like /login?error=1 still counts as "the login page" — a strict
// string match would wrongly read that as having navigated away. Falls back
// to strict equality for schemes without a meaningful origin (e.g. data:).
function samePage(a: string, b: string): boolean {
  try {
    const urlA = new URL(a);
    const urlB = new URL(b);
    return urlA.origin === urlB.origin && urlA.pathname === urlB.pathname;
  } catch {
    return a === b;
  }
}

export async function authenticate(
  manager: SessionManager,
  options: AuthenticateOptions,
): Promise<Cookie[]> {
  // 2 fills + 1 click per candidate submit-button label, per attempt
  const stepsPerAttempt = SUBMIT_BUTTON_LABELS.length * 3;
  const spawnResult = await hauntSpawn(manager, {
    persona: options.persona ?? 'confused-beginner',
    target_url: options.loginUrl,
    headless: options.headless,
    timeout: stepsPerAttempt * MAX_ATTEMPTS,
  });
  const sessionId = spawnResult.session_id;

  try {
    let lastFailure = 'unknown error';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await sleep(HYDRATION_PAUSE_MS);

      // Try each candidate label in turn, re-filling before each click. A
      // click can "succeed" against the wrong element — e.g. a header nav
      // link reading "Log in" that exists on every page, separate from the
      // actual submit button — so success is judged by whether the page
      // actually left the login route, not by whether *some* element
      // matching the label was found and clicked; a false lead can also
      // reset the form (a full-page nav), hence re-filling per candidate.
      let leftLoginPage = false;
      for (const label of SUBMIT_BUTTON_LABELS) {
        await hauntNavigate(manager, {
          session_id: sessionId,
          action: `fill ${options.email} in Email`,
        });
        await hauntNavigate(manager, {
          session_id: sessionId,
          action: `fill ${options.password} in Password`,
        });

        const clickResult = await hauntNavigate(manager, {
          session_id: sessionId,
          action: `click ${label}`,
        });
        if (!clickResult.success) {
          lastFailure = clickResult.error ?? lastFailure;
          continue;
        }

        await sleep(POST_SUBMIT_PAUSE_MS);
        const state = await hauntCaptureState(manager, {
          session_id: sessionId,
          include_screenshot: false,
          include_dom: false,
        });
        if (!samePage(state.url, options.loginUrl)) {
          leftLoginPage = true;
          break;
        }
        lastFailure = `clicked "${label}" but the page did not leave the login route`;
      }
      if (!leftLoginPage) continue;

      const { cookies } = await hauntGetCookies(manager, {
        session_id: sessionId,
      });
      return cookies;
    }

    throw new Error(
      `login failed after ${MAX_ATTEMPTS} attempts: ${lastFailure}`,
    );
  } finally {
    await hauntEndSession(manager, { session_id: sessionId });
  }
}
