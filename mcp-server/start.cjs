#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MIN_NODE_MAJOR = 18;
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < MIN_NODE_MAJOR) {
  process.stderr.write(
    `[haunt] Node.js ${MIN_NODE_MAJOR}+ is required, found ${process.version}. ` +
      'Update Node.js and try again.\n',
  );
  process.exit(1);
}

const SCRIPT_DIR = __dirname;
process.env.HAUNT_PERSONAS_DIR = path.join(SCRIPT_DIR, '..', 'personas');

// The Chromium revision must match whatever playwright-core is actually vendored in
// dist/node_modules — installing "latest" via npx can silently fetch a different
// revision than the bundled runtime expects, which then fails at launch with a
// confusing "Executable doesn't exist" error instead of a clear install message.
const playwrightCoreDir = path.join(SCRIPT_DIR, 'dist', 'node_modules', 'playwright-core');
const browsersJsonPath = path.join(playwrightCoreDir, 'browsers.json');
const expectedRevision = (() => {
  try {
    const browsers = JSON.parse(fs.readFileSync(browsersJsonPath, 'utf-8')).browsers;
    return browsers.find((b) => b.name === 'chromium')?.revision;
  } catch {
    return undefined;
  }
})();

// Playwright's browser cache lives in a different place per OS (and can be
// overridden entirely via PLAYWRIGHT_BROWSERS_PATH) — hardcoding the Linux path
// here meant this check was always false on macOS and Windows, silently
// re-running the install command on every single session start.
function resolvePlaywrightCacheDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  const home = process.env.HOME || process.env.USERPROFILE;
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'ms-playwright');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'ms-playwright');
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'ms-playwright');
}

const playwrightCache = resolvePlaywrightCacheDir();
const hasMatchingChromium =
  expectedRevision &&
  fs.existsSync(path.join(playwrightCache, `chromium-${expectedRevision}`));

if (!hasMatchingChromium) {
  process.stderr.write('[haunt] Installing Chromium (one-time setup, ~2 min)...\n');
  try {
    // Use the vendored playwright-core's own install CLI so the downloaded browser
    // revision always matches this exact bundled version — not whatever "npx playwright"
    // resolves to on npm at install time.
    execSync(`node "${path.join(playwrightCoreDir, 'cli.js')}" install chromium`, {
      stdio: 'inherit',
    });
  } catch (e) {
    process.stderr.write(
      '[haunt] Chromium install failed: ' + e.message +
      '\n[haunt] haunt_spawn will fail until this is resolved. Try running it manually:\n' +
      `[haunt]   node "${path.join(playwrightCoreDir, 'cli.js')}" install chromium\n`,
    );
  }
}

require('./dist/server.js');
