import { test, expect } from "../fixtures";
import { makeEvent, makeTicket, testEmail } from "../helpers/db";

test("ticket management loads real rows and summary controls", async ({
  superadminPage,
}) => {
  const event = await makeEvent({ name: "Ticket Browser Event" });
  const email = testEmail("browser-ticket");
  await makeTicket({ eventId: event.id, email, name: "Browser Attendee" });
  await superadminPage.goto(`/tickets/${event.id}`);

  await expect(superadminPage.getByText("Ticket management")).toBeVisible();
  await expect(
    superadminPage.getByText("Browser Attendee").first(),
  ).toBeVisible();
});

test("SAML metadata endpoint remains available", async ({ request }) => {
  const response = await request.get("/api/auth/metadata");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("EntityDescriptor");
});
