#!/usr/bin/env node
// scripts/check-versions.mjs
//
// The plugin's version and description are duplicated across files that can't
// easily share a single source of truth (JSON manifests read by different tools,
// a TS source literal, a markdown prompt string) — so instead of trying to
// eliminate the duplication, this fails CI the moment any of them drift apart.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf-8');
const readJSON = (path) => JSON.parse(read(path));

const errors = [];
const versions = [];

function checkVersion(label, value) {
  versions.push({ label, value });
}

const pluginManifest = readJSON('.claude-plugin/plugin.json');
checkVersion('.claude-plugin/plugin.json', pluginManifest.version);

const marketplace = readJSON('.claude-plugin/marketplace.json');
checkVersion('.claude-plugin/marketplace.json', marketplace.plugins[0]?.version);

const mcpPackage = readJSON('mcp-server/package.json');
checkVersion('mcp-server/package.json', mcpPackage.version);

const serverTs = read('mcp-server/src/server.ts');
const serverTsMatch = serverTs.match(/name:\s*'haunt',\s*version:\s*'([^']+)'/);
checkVersion(
  'mcp-server/src/server.ts',
  serverTsMatch ? serverTsMatch[1] : undefined,
);

const hauntTestMd = read('commands/haunt-test.md');
const hauntTestMdMatch = hauntTestMd.match(/haunt v([\d.]+)\s/);
checkVersion(
  'commands/haunt-test.md',
  hauntTestMdMatch ? hauntTestMdMatch[1] : undefined,
);

const missing = versions.filter((v) => !v.value);
if (missing.length > 0) {
  for (const v of missing) {
    errors.push(`Could not extract a version from ${v.label}`);
  }
}

const found = versions.filter((v) => v.value);
const distinctVersions = new Set(found.map((v) => v.value));
if (distinctVersions.size > 1) {
  errors.push(
    `Version mismatch:\n${found.map((v) => `  ${v.label}: ${v.value}`).join('\n')}`,
  );
}

const descriptions = [
  { label: '.claude-plugin/plugin.json', value: pluginManifest.description },
  {
    label: '.claude-plugin/marketplace.json',
    value: marketplace.plugins[0]?.description,
  },
];
const distinctDescriptions = new Set(descriptions.map((d) => d.value));
if (distinctDescriptions.size > 1) {
  errors.push(
    `Description mismatch:\n${descriptions.map((d) => `  ${d.label}: ${d.value}`).join('\n')}`,
  );
}

if (errors.length > 0) {
  console.error('[check-versions] FAILED\n');
  console.error(errors.join('\n\n'));
  process.exit(1);
}

console.log(
  `[check-versions] OK — all ${found.length} version strings match (${[...distinctVersions][0]})`,
);
