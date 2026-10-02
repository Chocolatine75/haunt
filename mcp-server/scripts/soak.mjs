#!/usr/bin/env node
// Runs a test path N times in a row and stops at the first failure. A gate
// that passes only sometimes is failing (docs/ROADMAP.md), and one green run
// does not show which kind it is.
//
//   node scripts/soak.mjs 20 src/gates
import { spawnSync } from 'node:child_process';

const [times = '20', ...paths] = process.argv.slice(2);
const runs = Number(times);
if (!Number.isInteger(runs) || runs < 1 || paths.length === 0) {
  console.error('Usage: node scripts/soak.mjs <runs> <test path...>');
  process.exit(2);
}

for (let run = 1; run <= runs; run++) {
  console.log(`[soak] run ${run}/${runs}`);
  const result = spawnSync('npx', ['vitest', 'run', ...paths], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`[soak] failed on run ${run}/${runs}`);
    process.exit(1);
  }
}
console.log(`[soak] ${runs}/${runs} runs passed`);
