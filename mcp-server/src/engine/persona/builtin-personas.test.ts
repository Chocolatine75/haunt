import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPersona } from './loader.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// The personas shipped with the plugin, at the repo root.
const PERSONAS_DIR = resolve(__dirname, '../../../../personas');

const files = readdirSync(PERSONAS_DIR).filter((f) => f.endsWith('.yaml'));

// A persona that fails schema validation only surfaces when a user runs it —
// these keep every shipped YAML loadable.
describe('built-in personas', () => {
  it('ships the three personas the README and command document', () => {
    expect(files.sort()).toEqual([
      'confused-beginner.yaml',
      'malicious-user.yaml',
      'screen-reader-user.yaml',
    ]);
  });

  it.each(files)('%s passes the persona schema', (file) => {
    const persona = loadPersona(resolve(PERSONAS_DIR, file));

    expect(persona.name.trim()).not.toBe('');
    expect(persona.description.trim()).not.toBe('');
    // The system prompt is what the orchestrator roleplays — a stub is a bug.
    expect(persona.system_prompt.length).toBeGreaterThan(200);
    expect(persona.browser.headless).toBe(true);
  });

  it.each(files)('%s has a usable first scenario', (file) => {
    const persona = loadPersona(resolve(PERSONAS_DIR, file));

    // haunt_spawn reads scenarios[0] for the goal and the default step budget.
    expect(persona.scenarios.length).toBeGreaterThan(0);
    expect(persona.scenarios[0].goal.trim()).not.toBe('');
    expect(persona.scenarios[0].max_steps).toBeGreaterThan(0);
  });

  it.each(files)('%s has a viewport a real device could have', (file) => {
    const { viewport } = loadPersona(resolve(PERSONAS_DIR, file)).browser;
    if (!viewport) return;
    expect(viewport.width).toBeGreaterThanOrEqual(320);
    expect(viewport.height).toBeGreaterThanOrEqual(480);
  });
});
