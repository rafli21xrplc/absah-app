import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig keeps jsx: preserve for Next; tests compile JSX with the automatic React runtime.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    // @absah/contracts and @absah/capabilities arrive from git as TypeScript source.
    server: { deps: { inline: [/@absah\//] } },
  },
});
