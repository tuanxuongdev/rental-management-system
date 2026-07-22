import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.integration.spec.ts', 'apps/worker/src/**/*.integration.spec.ts'],
    environment: 'node',
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
