import { defineConfig } from '@playwright/test';

// Serves the built Storybook (pnpm storybook:build) and checks every story. Port 6107 is not used by the other Absah apps.
const PORT = 6107;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory storybook-static`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    { name: 'terang', use: { colorScheme: 'light', viewport: { width: 390, height: 844 } } },
    { name: 'gelap', use: { colorScheme: 'dark', viewport: { width: 390, height: 844 } } },
  ],
});
