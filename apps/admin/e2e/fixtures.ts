import { test as base, type Page } from "@playwright/test";

import {
  cleanup,
  grantPermission,
  grantRole,
  makeEvent,
  makeUserProfile,
  testEmail,
} from "./helpers/db";
import {
  forgeSessionCookie,
  makeE2EUser,
  type E2ESessionUser,
} from "./helpers/session";

type Fixtures = {
  superadminUser: E2ESessionUser;
  superadminPage: Page;
  scopedAdminUser: E2ESessionUser;
  scopedAdminEvent: Awaited<ReturnType<typeof makeEvent>>;
  scopedAdminPage: Page;
};

async function authenticate(page: Page, email: string): Promise<void> {
  await makeUserProfile(email);
  await page
    .context()
    .addCookies([await forgeSessionCookie(makeE2EUser(email))]);
}

export const test = base.extend<Fixtures>({
  superadminUser: async ({}, provide) => {
    await provide(makeE2EUser(testEmail("superadmin")));
  },
  superadminPage: async ({ page, superadminUser }, provide) => {
    await authenticate(page, superadminUser.email);
    await grantRole(superadminUser.email, "admin");
    await provide(page);
    await cleanup();
  },
  scopedAdminUser: async ({}, provide) => {
    await provide(makeE2EUser(testEmail("scoped-admin")));
  },
  scopedAdminEvent: async ({}, provide) => {
    await provide(await makeEvent({ name: "Scoped Admin Event" }));
  },
  scopedAdminPage: async (
    { page, scopedAdminUser, scopedAdminEvent },
    provide,
  ) => {
    await authenticate(page, scopedAdminUser.email);
    await grantPermission({
      email: scopedAdminUser.email,
      action: "tickets.view",
      eventId: scopedAdminEvent.id,
    });
    await provide(page);
    await cleanup();
  },
});

export { expect } from "@playwright/test";
