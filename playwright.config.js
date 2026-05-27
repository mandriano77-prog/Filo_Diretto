// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: process.env.E2E_START_SERVER === '1'
    ? {
        command: 'npm start',
        url: process.env.E2E_BASE_URL || 'http://localhost:3000/health',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
    : undefined
});
