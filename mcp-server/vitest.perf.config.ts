import { defineConfig } from 'vitest/config';

// The performance budgets of the gates, run alone and one file at a time so
// that what is measured is haunt and not the rest of the suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.perf.test.ts'],
    fileParallelism: false,
  },
});
