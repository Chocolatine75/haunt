import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  clean: true,
  // all npm deps are installed at runtime via start.sh — keep them external here
  external: ['playwright', 'playwright-core', '@playwright/test'],
});
