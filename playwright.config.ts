import { defineConfig, devices } from "@playwright/test";

import {
  LOCAL_TEST_DATABASE_URL,
  TEST_SESSION_SECRET,
} from "./tests/helpers/env";

// Playwright workers do not inherit webServer.env. Force the same local-only
// values into the runner process before any fixture module is evaluated.
process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
process.env.SESSION_SECRET = TEST_SESSION_SECRET;
process.env.SESSION_COOKIE_NAME = "ssb_session";

const webEnv = {
  ...process.env,
  DATABASE_URL: LOCAL_TEST_DATABASE_URL,
  SESSION_SECRET: TEST_SESSION_SECRET,
  SESSION_COOKIE_NAME: "ssb_session",
  SESSION_COOKIE_SECURE: "false",
  DISABLE_EMAIL: "true",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  AWS_REGION: "us-west-2",
  NEXT_PUBLIC_BASE_URL: "http://localhost:3100",
  E2E_TESTS: "true",
};
const adminEnv = {
  ...webEnv,
  NEXT_PUBLIC_BASE_URL: "http://localhost:3101",
  NEXT_PUBLIC_ROOT_URL: "http://localhost:3101",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.CROSS_APP
    ? [
        {
          command: "bun run dev -- -p 3100",
          url: "http://localhost:3100",
          timeout: 240_000,
          reuseExistingServer: !process.env.CI,
          env: webEnv,
        },
        {
          command: "bun run dev -- -p 3101",
          cwd: "../admin",
          url: "http://localhost:3101",
          timeout: 240_000,
          reuseExistingServer: !process.env.CI,
          env: adminEnv,
        },
      ]
    : {
        command: "bun run dev -- -p 3100",
        url: "http://localhost:3100",
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: webEnv,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["a11y/**", "cross-app/**"],
    },
    {
      name: "a11y",
      testDir: "./e2e/a11y",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.CROSS_APP
      ? [
          {
            name: "cross-app",
            testDir: "./e2e/cross-app",
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],
});
