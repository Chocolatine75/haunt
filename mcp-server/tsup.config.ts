import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  clean: true,
  // playwright stays external — its JS is shipped in dist/node_modules/ instead
  external: ['playwright', 'playwright-core', 'chromium-bidi', '@playwright/test'],
  // bundle all other pure-JS deps — no npm install needed at runtime
  noExternal: [/^(?!playwright|chromium-bidi|@playwright)/],
  // shim for CJS require() calls inside bundled deps
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
