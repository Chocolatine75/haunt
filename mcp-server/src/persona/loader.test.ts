import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadPersona } from './loader.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '__fixtures__');

describe('loadPersona', () => {
  it('loads a valid persona YAML', () => {
    const persona = loadPersona(resolve(FIXTURES, 'valid-persona.yaml'));
    expect(persona.name).toBe('Test Persona');
    expect(persona.system_prompt).toBe('You are testing.');
    expect(persona.scenarios).toHaveLength(1);
    expect(persona.scenarios[0].max_steps).toBe(10);
  });

  it('throws on missing file', () => {
    expect(() => loadPersona('/nonexistent/path.yaml')).toThrow();
  });

  it('throws on invalid YAML structure', () => {
    expect(() => loadPersona(resolve(FIXTURES, 'invalid-persona.yaml'))).toThrow();
  });

  it('applies default max_steps when omitted', () => {
    const persona = loadPersona(resolve(FIXTURES, 'valid-persona.yaml'));
    expect(persona.scenarios[0].max_steps).toBeGreaterThan(0);
  });
});
