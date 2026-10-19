// mcp-server/src/cli/authenticate.ts
//
// Deterministic login flow for haunt-ci / haunt-benchmark, mirroring
// commands/haunt-test.md's interactive Phase 0.5 but with no LLM call. The
// fields are found in the page snapshot by what they are (an email or user
// field, then a password field), not by what a label happens to say, and the
// form is submitted the way a user would: Enter in the password field, then
// failing that the first button after it.
import type { Cookie } from 'playwright';
import { hauntAct } from '../engine/act/act.js';
import { hauntCaptureState } from '../engine/capture.js';
import { hauntEndSession } from '../engine/end-session.js';
import { hauntGetCookies } from '../engine/get-cookies.js';
import type { SessionManager } from '../engine/session/manager.js';
import { hauntSpawn } from '../engine/spawn.js';

export interface AuthenticateOptions {
  loginUrl: string;
  email: string;
  password: string;
  headless: boolean;
  // Ignored: personas are gone. Still accepted from a caller written
  // before.
  persona?: string;
}

// A click that arrives before client-side hydration finishes falls through
// to the browser's native form submission, which wipes the fields instead of
// running the app's handler. Dev servers compile routes on demand, so how
// long that takes varies: a second attempt after a pause is cheaper than
// guessing one pause long enough to never be wrong.
const RETRY_PAUSE_MS = 1_500;
const MAX_ATTEMPTS = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const USER_FIELD = /e-?mail|user(name)?|login|identifiant/i;

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
  const spawnResult = await hauntSpawn(manager, {
    target_url: options.loginUrl,
    headless: options.headless,
    // Two fills and a click per attempt, with room to spare.
    timeout: MAX_ATTEMPTS * 6,
  });
  const session_id = spawnResult.session_id;
  const leftLoginPage = (url: string) => !samePage(url, options.loginUrl);

  try {
    let lastFailure = 'unknown error';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) await sleep(RETRY_PAUSE_MS);

      const { elements = [] } = await hauntCaptureState(manager, {
        session_id,
        format: 'json',
      });
      const passwordAt = elements.findIndex((e) => e.input_type === 'password');
      const password = elements[passwordAt];
      const user =
        elements.find((e) => e.input_type === 'email') ??
        elements
          .slice(0, Math.max(passwordAt, 0))
          .reverse()
          .find(
            (e) =>
              (e.role === 'textbox' || e.role === 'searchbox') &&
              e.input_type !== 'password' &&
              USER_FIELD.test(`${e.name} ${e.placeholder ?? ''}`),
          );
      if (!user || !password) {
        lastFailure = `no ${user ? 'password' : 'email'} field was found on the login page`;
        continue;
      }

      // Enter in the password field submits a real form.
      const typed = await hauntAct(manager, {
        session_id,
        actions: [
          { type: 'fill', ref: user.ref, text: options.email },
          {
            type: 'fill',
            ref: password.ref,
            text: options.password,
            submit: true,
          },
        ],
      });
      if (leftLoginPage(typed.url)) return await cookiesOf(manager, session_id);
      const failed = typed.results.find((r) => !r.ok);
      if (failed) {
        lastFailure = failed.error?.message ?? lastFailure;
        continue;
      }
      if (typed.results.some((r) => r.changes.navigated)) {
        // Submitted, and sent back to the login page.
        lastFailure = 'the page did not leave the login route';
        continue;
      }

      // Nothing happened: there is no form to submit, only a button. The
      // first one after the password field is the one a user would press —
      // not a link that merely reads "Log in" somewhere above.
      const button = elements
        .slice(passwordAt + 1)
        .find((e) => e.role === 'button' && !e.disabled && !e.hidden);
      if (!button) {
        lastFailure = 'no submit button was found after the password field';
        continue;
      }
      const clicked = await hauntAct(manager, {
        session_id,
        actions: [{ type: 'click', ref: button.ref }],
      });
      if (leftLoginPage(clicked.url))
        return await cookiesOf(manager, session_id);
      lastFailure =
        clicked.results[0]?.error?.message ??
        `clicked "${button.name}" but the page did not leave the login route`;
    }

    throw new Error(
      `login failed after ${MAX_ATTEMPTS} attempts: ${lastFailure}`,
    );
  } finally {
    await hauntEndSession(manager, { session_id });
  }
}

async function cookiesOf(
  manager: SessionManager,
  session_id: string,
): Promise<Cookie[]> {
  return (await hauntGetCookies(manager, { session_id })).cookies;
}
