import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/contracts/src/**/*.spec.ts', 'apps/api/src/**/*.spec.ts'],
    exclude: ['**/*.integration.spec.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
