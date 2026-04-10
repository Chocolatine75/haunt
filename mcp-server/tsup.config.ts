import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  clean: true,
  // playwright cannot be bundled (native binaries) — users install it separately
  external: ['playwright', 'playwright-core', '@playwright/test'],
});
