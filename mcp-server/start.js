#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_DIR = __dirname;
process.env.HAUNT_PERSONAS_DIR = path.join(SCRIPT_DIR, '..', 'personas');

const home = process.env.HOME || process.env.USERPROFILE;
const playwrightCache = path.join(home, '.cache', 'ms-playwright');
const hasChromium = fs.existsSync(playwrightCache) &&
  fs.readdirSync(playwrightCache).some(d => d.startsWith('chromium-'));

if (!hasChromium) {
  process.stderr.write('[haunt] Installing Chromium (one-time setup, ~2 min)...\n');
  try {
    execSync('npx --yes playwright install chromium', { stdio: 'inherit' });
  } catch (e) {
    process.stderr.write('[haunt] Chromium install failed: ' + e.message + '\n');
  }
}

require('./dist/server.js');
