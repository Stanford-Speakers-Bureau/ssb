import { defineConfig, devices } from "@playwright/test";

import {
  LOCAL_TEST_DATABASE_URL,
  TEST_SESSION_SECRET,
  TEST_SUPABASE_URL,
  TEST_SUPABASE_KEY,
  TEST_APPLE_WALLET_SECRET,
  TEST_SAML_SP_ENTITY_ID,
  TEST_SAML_SP_PRIVATE_KEY,
  TEST_SAML_SP_PUBLIC_CERT,
} from "./tests/helpers/env";

process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
process.env.SESSION_SECRET = TEST_SESSION_SECRET;
process.env.SESSION_COOKIE_NAME = "ssb_session";

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
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev -- -p 3101",
    url: "http://localhost:3101",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_TEST_DATABASE_URL,
      SESSION_SECRET: TEST_SESSION_SECRET,
      SESSION_COOKIE_NAME: "ssb_session",
      SESSION_COOKIE_SECURE: "false",
      DISABLE_EMAIL: "true",
      AWS_ACCESS_KEY_ID: "test-access-key",
      AWS_SECRET_ACCESS_KEY: "test-secret-key",
      AWS_REGION: "us-west-2",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3101",
      NEXT_PUBLIC_ROOT_URL: "http://localhost:3101",
      SUPABASE_URL: TEST_SUPABASE_URL,
      SUPABASE_KEY: TEST_SUPABASE_KEY,
      APPLE_WALLET_SECRET: TEST_APPLE_WALLET_SECRET,
      SAML_SP_ENTITY_ID: TEST_SAML_SP_ENTITY_ID,
      SP_PRIVATE_KEY: TEST_SAML_SP_PRIVATE_KEY,
      SP_PUBLIC_CERT: TEST_SAML_SP_PUBLIC_CERT,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["a11y/**"],
    },
    {
      name: "a11y",
      testDir: "./e2e/a11y",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
