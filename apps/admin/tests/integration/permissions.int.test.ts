import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hasPermission } from "@/app/lib/permissions";
import { getEffectivePermissions } from "@/app/lib/permissions";
import {
  cleanup,
  closeTestDatabase,
  grantPermission,
  grantRole,
  makeEvent,
  testEmail,
} from "../helpers/factories";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

integration("real permission grants", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("admin role bypasses scoped grants", async () => {
    const email = testEmail("superadmin");
    const event = await makeEvent();
    await grantRole(email, "admin");

    expect(await hasPermission(email, "tickets.delete", event.id)).toBe(true);
    expect(await hasPermission(email, "events.create")).toBe(true);
  });

  test("an event grant applies only to its event", async () => {
    const email = testEmail("scoped");
    const allowedEvent = await makeEvent();
    const blockedEvent = await makeEvent();
    await grantPermission({
      email,
      action: "tickets.view",
      eventId: allowedEvent.id,
    });

    expect(await hasPermission(email, "tickets.view", allowedEvent.id)).toBe(
      true,
    );
    expect(await hasPermission(email, "tickets.view", blockedEvent.id)).toBe(
      false,
    );
  });

  test("NULL scope and implication rules are enforced from real rows", async () => {
    const email = testEmail("global");
    const event = await makeEvent();
    await grantPermission({ email, action: "tickets.edit", eventId: null });

    expect(await hasPermission(email, "tickets.edit", event.id)).toBe(true);
    expect(await hasPermission(email, "tickets.view", event.id)).toBe(true);
    expect(await hasPermission(email, "tickets.delete", event.id)).toBe(false);
  });

  test("email lookup is canonical and delete implies view but not edit", async () => {
    const email = testEmail("canonical-permission");
    const event = await makeEvent();
    await grantPermission({
      email,
      action: "tickets.delete",
      eventId: event.id,
    });

    expect(
      await hasPermission(
        `  ${email.toUpperCase()}  `,
        "tickets.view",
        event.id,
      ),
    ).toBe(true);
    expect(await hasPermission(email, "tickets.edit", event.id)).toBe(false);
  });

  test("invalid stored actions are excluded from effective permissions", async () => {
    const email = testEmail("invalid-permission");
    await grantPermission({ email, action: "not.a.permission", eventId: null });

    const effective = await getEffectivePermissions(email);
    expect(effective.actions.size).toBe(0);
    expect(effective.allEventActions.size).toBe(0);
  });
});
