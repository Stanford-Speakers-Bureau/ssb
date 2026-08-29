import type { Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAccessible } from "../helpers/a11y";
import { cleanup, makeEvent } from "../helpers/db";
import { buildEventUnsubscribeLink } from "../../app/lib/unsubscribe-links";

test.afterEach(cleanup);

async function check(
  page: Page,
  path: string,
  testInfo: Parameters<typeof expectAccessible>[1],
) {
  await page.goto(path);
  await expectAccessible(page, testInfo);
}

for (const [name, path] of [
  ["home", "/"],
  ["suggest", "/suggest"],
  ["past speakers", "/past-speakers"],
] as const) {
  test(`${name} has no serious WCAG A/AA violations`, async ({
    page,
  }, testInfo) => {
    await check(page, path, testInfo);
  });
}

test("event has no serious WCAG A/AA violations", async ({
  page,
}, testInfo) => {
  const event = await makeEvent({ name: "Accessible Public Event" });
  await check(page, `/events/${event.route}`, testInfo);
});

test("account has no serious WCAG A/AA violations", async ({
  signedInPage,
}, testInfo) => {
  await check(signedInPage, "/account", testInfo);
});

test("subscribe confirmation has no serious WCAG A/AA violations", async ({
  signedInPage,
}, testInfo) => {
  await check(signedInPage, "/subscribe", testInfo);
});

test("unsubscribe has no serious WCAG A/AA violations", async ({
  page,
}, testInfo) => {
  const event = await makeEvent({ name: "Accessible Unsubscribe Event" });
  const link = await buildEventUnsubscribeLink({
    baseUrl: "http://localhost:3100",
    email: "a11y-unsubscribe@example.test",
    eventId: event.id,
  });
  const url = new URL(link);
  await check(page, `${url.pathname}${url.search}`, testInfo);
});

test("questions has no serious WCAG A/AA violations", async ({
  page,
}, testInfo) => {
  const event = await makeEvent({
    name: "Accessible Questions Event",
    questionsEnabled: true,
  });
  await check(page, `/events/${event.route}/questions`, testInfo);
});
