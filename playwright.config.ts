import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "api",
      testMatch: /.*\.api\.ts/,
    },
    {
      name: "ui",
      testMatch: /.*\.ui\.ts/,
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm --filter web dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
