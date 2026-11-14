import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config';

/**
 * Project graph:
 *
 *   setup ──► api
 *     │   └─► ui-chromium
 *     └── teardown: cleanup (runs after everything that depends on setup)
 *
 * `setup` authenticates every role once per run; tests never log in themselves.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.isCI,
  // The target is a shared public environment with occasional network hiccups; retry in CI only
  // so flakiness is still visible locally ("flaky" status in the report instead of hidden).
  retries: env.isCI ? 2 : 0,
  // Be a good citizen on a shared environment; tests are data-isolated so this can be raised safely.
  workers: env.workers,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: env.isCI
    ? [['list'], ['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'setup/**/*.setup.ts',
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: 'setup/**/*.teardown.ts',
    },
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      dependencies: ['setup'],
    },
    {
      name: 'ui-chromium',
      testMatch: 'ui/**/*.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
