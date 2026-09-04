import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/index.ts', cli: 'src/cli/headless.ts' },
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  clean: true,
  // playwright stays external — its JS is shipped in dist/node_modules/ instead.
  // @opentelemetry/api is an optional peer of @mistralai/mistralai: it's reached
  // only via a dynamic import() the SDK itself wraps in try/catch to no-op tracing
  // when the package isn't installed — leaving it external (unresolved, matching
  // "not installed") is exactly what that fallback expects, not a runtime risk.
  external: [
    'playwright',
    'playwright-core',
    'chromium-bidi',
    '@playwright/test',
    '@opentelemetry/api',
  ],
  // bundle all other pure-JS deps — no npm install needed at runtime
  noExternal: [/^(?!playwright|chromium-bidi|@playwright|@opentelemetry\/api)/],
  // shim for CJS require() calls inside bundled deps
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
