import { test, expect } from "../fixtures";
import { makeEvent } from "../helpers/db";

test("superadmin sees the dashboard and privileged navigation", async ({
  superadminPage,
}) => {
  await makeEvent({ name: "Admin Dashboard Fixture" });
  await superadminPage.goto("/");

  await expect(
    superadminPage.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  await expect(
    superadminPage.getByRole("link", { name: "Users" }),
  ).toBeVisible();
  await expect(
    superadminPage
      .locator("option")
      .filter({ hasText: "Admin Dashboard Fixture" })
      .first(),
  ).toHaveCount(1);
});

test("event-scoped admin does not receive superadmin navigation", async ({
  scopedAdminPage,
}) => {
  await scopedAdminPage.goto("/");
  await expect(
    scopedAdminPage.getByRole("link", { name: "Tickets" }).first(),
  ).toBeVisible();
  await expect(
    scopedAdminPage.getByRole("link", { name: "Users" }),
  ).toHaveCount(0);
});
