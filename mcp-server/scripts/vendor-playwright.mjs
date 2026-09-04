// Copies playwright + playwright-core from node_modules into dist/node_modules.
// tsup marks them "external" (see tsup.config.ts) so the built server can require()
// them at runtime without the end user running `npm install` — but `tsup`'s clean
// step wipes dist/ on every build, so this vendored copy has to be re-created after
// every build rather than committed as a one-off manual step.
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = dirname(__dirname);
const src = join(root, 'node_modules');
const dest = join(root, 'dist', 'node_modules');

const PACKAGES = ['playwright', 'playwright-core'];

mkdirSync(dest, { recursive: true });

for (const pkg of PACKAGES) {
  const from = join(src, pkg);
  const to = join(dest, pkg);
  if (!existsSync(from)) {
    throw new Error(`[vendor-playwright] ${pkg} not found in node_modules — run npm install first.`);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`[vendor-playwright] copied ${pkg}`);
}

// tsup preserves the shebang from src/cli/headless.ts, but the executable bit
// itself isn't set on a fresh build output — needed for `bin/haunt-ci` and direct
// `./dist/cli.js` invocation (irrelevant on Windows, where npm generates its own
// .cmd shim regardless).
const cliPath = join(root, 'dist', 'cli.js');
if (existsSync(cliPath)) {
  chmodSync(cliPath, 0o755);
  console.log('[vendor-playwright] chmod +x dist/cli.js');
}
