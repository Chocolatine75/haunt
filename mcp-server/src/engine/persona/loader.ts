import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { PersonaConfig } from '../types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// When bundled by tsup, import.meta.url resolves to dist/server.js or dist/cli.js —
// __dirname is mcp-server/dist/, so two levels up reaches the repo root (haunt/),
// where personas/ lives. Previously three levels ('../../../personas'), which
// landed one directory above the repo — masked everywhere start.cjs runs because
// it always sets HAUNT_PERSONAS_DIR before requiring dist/server.js, but a real
// bug for any other entrypoint (e.g. dist/cli.js) that doesn't set it.
// HAUNT_PERSONAS_DIR env var (set in .mcp.json, and by start.cjs) overrides this path.
const BUILTIN_PERSONAS_DIR =
  process.env.HAUNT_PERSONAS_DIR ?? resolve(__dirname, '../../personas');

const PersonaSchema = z.object({
  name: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  browser: z.object({
    headless: z.boolean().default(true),
    viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    locale: z.string().optional(),
  }),
  scenarios: z
    .array(
      z.object({
        name: z.string(),
        goal: z.string(),
        max_steps: z.number().default(30),
      }),
    )
    .default([
      {
        name: 'Free Exploration',
        goal: 'Explore the application freely',
        max_steps: 30,
      },
    ]),
});

export function loadPersona(nameOrPath: string): PersonaConfig {
  const filePath =
    nameOrPath.endsWith('.yaml') || nameOrPath.endsWith('.yml')
      ? nameOrPath
      : resolve(BUILTIN_PERSONAS_DIR, `${nameOrPath}.yaml`);

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  return PersonaSchema.parse(parsed) as PersonaConfig;
}
