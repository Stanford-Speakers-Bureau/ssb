import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures";
import { cleanup, makeEvent } from "../helpers/db";
import { buildEventUnsubscribeLink } from "../../app/lib/unsubscribe-links";

test.skip(
  !process.env.CI && process.env.VISUAL !== "1",
  "visual suite is opt-in locally",
);

test.afterEach(cleanup);

async function stabilize(page: Page, path: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  const popupClose = page.getByRole("button", { name: "Close" });
  if (await popupClose.isVisible()) await popupClose.click();
  await page.locator("canvas").evaluateAll((nodes) => {
    for (const node of nodes) node.remove();
  });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{caret-color:transparent!important;animation:none!important;transition:none!important}",
  });
}

async function commonMasks(page: Page) {
  return [
    ...(await page.locator("img").all()),
    page.locator("footer").getByText(/© \d{4}/),
  ];
}

test("home visual", async ({ page }) => {
  await stabilize(page, "/");
  await expect(page).toHaveScreenshot("web-home.png", {
    animations: "disabled",
    mask: await commonMasks(page),
  });
});

test("open event visual", async ({ page }) => {
  const event = await makeEvent({ name: "Visual Open Event" });
  await stabilize(page, `/events/${event.route}`);
  await expect(page).toHaveScreenshot("web-event-open.png", {
    animations: "disabled",
    mask: await commonMasks(page),
  });
});

test("pre-release mystery visual", async ({ page }) => {
  const event = await makeEvent({
    name: "Visual Hidden Mystery",
    releaseDate: new Date("2099-01-01T00:00:00Z"),
  });
  await stabilize(page, `/events/${event.route}`);
  await expect(page).toHaveScreenshot("web-event-mystery.png", {
    animations: "disabled",
    mask: await commonMasks(page),
  });
});

test("past event visual", async ({ page }) => {
  const event = await makeEvent({
    name: "Visual Past Event",
    startTimeDate: new Date("2020-01-01T19:00:00-08:00"),
    endTimeDate: new Date("2020-01-01T21:00:00-08:00"),
  });
  await stabilize(page, `/events/${event.route}`);
  await expect(page).toHaveScreenshot("web-event-past.png", {
    animations: "disabled",
    mask: await commonMasks(page),
  });
});

test("sold-out event visual", async ({ signedInPage }) => {
  const event = await makeEvent({ name: "Visual Sold Out Event", capacity: 0 });
  await stabilize(signedInPage, `/events/${event.route}`);
  await expect(signedInPage).toHaveScreenshot("web-event-sold-out.png", {
    animations: "disabled",
    mask: await commonMasks(signedInPage),
  });
});

test("suggest visual", async ({ page }) => {
  await stabilize(page, "/suggest");
  await expect(page).toHaveScreenshot("web-suggest.png", {
    animations: "disabled",
    mask: await commonMasks(page),
  });
});

test("signed-in account visual", async ({ signedInPage }) => {
  await stabilize(signedInPage, "/account");
  await expect(signedInPage).toHaveScreenshot("web-account.png", {
    animations: "disabled",
    mask: await commonMasks(signedInPage),
  });
});

test("subscribe confirmation visual", async ({ signedInPage }) => {
  await stabilize(signedInPage, "/subscribe");
  await expect(signedInPage).toHaveScreenshot("web-subscribe.png", {
    animations: "disabled",
    mask: await commonMasks(signedInPage),
  });
});

test("unsubscribe visual", async ({ page }) => {
  const event = await makeEvent({ name: "Visual Unsubscribe Event" });
  const link = await buildEventUnsubscribeLink({
    baseUrl: "http://localhost:3100",
    email: "visual-unsubscribe@example.test",
    eventId: event.id,
  });
  await stabilize(page, new URL(link).pathname + new URL(link).search);
  await expect(page).toHaveScreenshot("web-unsubscribe.png", {
    animations: "disabled",
    mask: await commonMasks(page),
  });
});
