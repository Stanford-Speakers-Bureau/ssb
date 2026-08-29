import { test, expect } from "../fixtures";
import { makeEvent, makeTicket } from "../helpers/db";

test("an open event renders from a real database fixture", async ({ page }) => {
  const event = await makeEvent({
    name: "Browser Contract Event",
    capacity: 20,
  });
  await page.goto(`/events/${event.route}`);

  await expect(
    page.getByRole("heading", { name: "Browser Contract Event" }),
  ).toBeVisible();
});

test("event routes distinguish mystery, past, and sold-out states", async ({
  signedInPage,
}) => {
  const mystery = await makeEvent({
    name: "Hidden Mystery Speaker",
    releaseDate: new Date("2099-01-01T00:00:00Z"),
  });
  const mysteryResponse = await signedInPage.goto(`/events/${mystery.route}`);
  expect(mysteryResponse?.status()).toBe(200);
  await expect(
    signedInPage.getByText("This event is not public yet", { exact: false }),
  ).toBeVisible();
  await expect(signedInPage.getByText("Hidden Mystery Speaker")).toHaveCount(0);

  const past = await makeEvent({
    name: "Past Browser Event",
    startTimeDate: new Date("2020-01-01T19:00:00-08:00"),
    endTimeDate: new Date("2020-01-01T21:00:00-08:00"),
  });
  const pastResponse = await signedInPage.goto(`/events/${past.route}`);
  expect(pastResponse?.status()).toBe(200);
  await expect(
    signedInPage.getByRole("heading", { name: "Past Browser Event" }),
  ).toBeVisible();
  await expect(
    signedInPage.getByRole("button", { name: "Get Ticket" }),
  ).toHaveCount(0);

  const soldOut = await makeEvent({
    name: "Sold Out Browser Event",
    capacity: 0,
  });
  await signedInPage.goto(`/events/${soldOut.route}`);
  // A sold-out event still surfaces a live ticket affordance (which enrolls the
  // viewer onto the waitlist), in contrast to the past event above, which shows
  // no purchase button at all. The label is "Get Ticket" on the current accent
  // theme and "Join Online Waitlist" once the dedicated JoinWaitlist component
  // lands, so accept either.
  await expect(
    signedInPage.getByRole("button", {
      name: /Get Ticket|Join Online Waitlist/i,
    }),
  ).toBeVisible();
});

test("signed-in account reads the forged session and database ticket", async ({
  signedInPage,
}) => {
  const event = await makeEvent({ name: "Account Fixture Event" });
  const cookie = (await signedInPage.context().cookies()).find(
    (candidate) => candidate.name === "ssb_session",
  );
  expect(cookie).toBeTruthy();

  // The session user is intentionally discovered from the account response;
  // fixture-level session compatibility is covered by the unit canary.
  await signedInPage.goto("/account");
  await expect(
    signedInPage.getByRole("heading", { name: /Hi,/ }),
  ).toBeVisible();
  await expect(
    signedInPage.getByRole("heading", { name: "My tickets" }),
  ).toBeVisible();

  const email = await signedInPage
    .locator("main p")
    .filter({ hasText: "@it.test" })
    .first()
    .textContent();
  if (!email)
    throw new Error("Account did not render the forged session email");
  await makeTicket({ eventId: event.id, email: email.trim() });
  await signedInPage.reload();
  await expect(signedInPage.getByText("Account Fixture Event")).toBeVisible();
});

test("signed-out account starts the authentication flow", async ({ page }) => {
  await page.goto("/account");
  expect(page.url()).toContain("login.stanford.edu");
});
