import { defineConfig } from 'vitest/config';

// Tests run outside the Worker: server code against a D1 stand-in (src/test/d1.ts),
// components in jsdom. Vite's Cloudflare and React Router plugins are not loaded here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**'],
    },
  },
  resolve: { tsconfigPaths: true },
});
