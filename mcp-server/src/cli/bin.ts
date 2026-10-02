#!/usr/bin/env node
// mcp-server/src/cli/bin.ts
//
// haunt-ci's entrypoint, kept separate from headless.ts on purpose. tsup splits
// code shared between entries into chunks, and headless.ts is shared (the
// benchmark imports it) — so an "am I the main module?" guard inside it ends up
// in a chunk whose import.meta.url is never the script Node was started with.
// The guard was then always false and `haunt-ci` exited 0 without running
// anything. Nothing imports this file, so it can simply call main().
import { main } from './headless.js';

main();
