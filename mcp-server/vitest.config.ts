import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entrypoints that only wire things together and start a process — they
      // are exercised through dist/ by distribution.test.ts, which v8 coverage
      // of src/ cannot see.
      exclude: [
        'src/**/*.test.ts',
        'src/test-support/**',
        'src/mcp/index.ts',
        'src/cli/bin.ts',
        'src/benchmark/bin.ts',
        'src/engine/types.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 85,
        branches: 90,
        functions: 90,
        lines: 85,
      },
    },
  },
});
