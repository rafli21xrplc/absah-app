import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Component tests opt in to the DOM with `// @vitest-environment jsdom`; the token tests stay in node.
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
