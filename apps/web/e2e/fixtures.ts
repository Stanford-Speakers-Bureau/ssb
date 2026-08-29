import { test as base, type Page } from "@playwright/test";

import { cleanup, grantRole, makeUserProfile, testEmail } from "./helpers/db";
import {
  forgeSessionCookie,
  makeE2EUser,
  type E2ESessionUser,
} from "./helpers/session";

type Fixtures = {
  signedInUser: E2ESessionUser;
  signedInPage: Page;
  scannerPage: Page;
};

async function authenticate(page: Page, email: string): Promise<void> {
  await makeUserProfile(email);
  await page
    .context()
    .addCookies([await forgeSessionCookie(makeE2EUser(email))]);
}

export const test = base.extend<Fixtures>({
  signedInUser: async ({}, provide) => {
    await provide(makeE2EUser(testEmail("browser-user")));
  },
  signedInPage: async ({ page, signedInUser }, provide) => {
    await authenticate(page, signedInUser.email);
    await provide(page);
    await cleanup();
  },
  scannerPage: async ({ page }, provide) => {
    const email = testEmail("scanner");
    await authenticate(page, email);
    await grantRole(email, "scanner");
    await provide(page);
    await cleanup();
  },
});

export { expect } from "@playwright/test";
