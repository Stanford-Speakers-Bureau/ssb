import { test, expect } from "@playwright/test";

test("home renders its primary navigation and hero", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { name: /Stanford Speakers Bureau/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Upcoming Speakers" }).first(),
  ).toBeVisible();
});

test("public navigation destinations do not return errors", async ({
  page,
}) => {
  for (const path of [
    "/upcoming-speakers",
    "/past-speakers",
    "/team",
    "/contact",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBeLessThan(400);
  }
});

test("SAML metadata is XML and login begins a redirect", async ({
  request,
}) => {
  const metadata = await request.get("/api/auth/metadata");
  expect(metadata.ok()).toBe(true);
  expect(metadata.headers()["content-type"]).toContain("xml");
  expect(await metadata.text()).toContain("EntityDescriptor");

  const login = await request.get("/api/auth/login", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(login.status());
});
