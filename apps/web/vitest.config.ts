import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    // @absah/contracts and @absah/capabilities arrive from git as TypeScript source.
    server: { deps: { inline: [/@absah\//] } },
  },
});
