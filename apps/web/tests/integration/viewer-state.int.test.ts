import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

import type { E2ESessionUser } from "../../e2e/helpers/session";
import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  makeEvent,
  makeTicket,
  makeWaitlistEntry,
  registerCleanup,
  testEmail,
} from "../helpers/factories";

let currentUser: E2ESessionUser | null = null;
// Register the module mock only when this integration suite actually runs.
// `mock.module` is process-global in Bun, so an unconditional top-level mock
// here would leak a partial `@/app/lib/auth` into the unit run (where this
// file is loaded but skipped) and break other suites' auth imports.
if (process.env.TEST_INTEGRATION === "1") {
  mock.module("@/app/lib/auth", () => ({
    getSessionUser: async () => currentUser,
  }));
}

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

integration("viewer event state", () => {
  afterEach(async () => {
    currentUser = null;
    await cleanup();
  });
  afterAll(closeTestDatabase);

  test("returns the stable anonymous shape", async () => {
    const { getViewerEventState } =
      await import("@/app/lib/viewer-event-state");
    const event = await makeEvent();
    expect(await getViewerEventState(event.id)).toEqual({
      authenticated: false,
      userEmail: null,
      ticketId: null,
      ticketType: null,
      ticketName: null,
      ticketScanned: false,
      isOnWaitlist: false,
      waitlistPosition: null,
      isNotified: false,
      allowAdmittingStandby: false,
    });
  });

  test("derives ticket, waitlist, notify, and admission state in one query", async () => {
    const { getViewerEventState } =
      await import("@/app/lib/viewer-event-state");
    const sql = getTestDatabase();
    const email = testEmail("viewer");
    const event = await makeEvent({ allowAdmittingStandby: true });
    const ticket = await makeTicket({
      eventId: event.id,
      email,
      name: "Viewer User",
      type: "VIP",
      scanned: true,
    });
    await makeWaitlistEntry({ eventId: event.id, email, position: 4 });
    const notifyId = crypto.randomUUID();
    await sql`
      insert into notify (id, email, speaker_id)
      values (${notifyId}, ${email}, ${event.id})
    `;
    registerCleanup(() => sql`delete from notify where id = ${notifyId}`);
    currentUser = {
      email,
      uid: email,
      displayName: "Viewer User",
      eduPersonAffiliation: ["student"],
      eduPersonScopedAffiliation: ["student@stanford.edu"],
    };

    expect(await getViewerEventState(event.id)).toEqual({
      authenticated: true,
      userEmail: email,
      ticketId: ticket.id,
      ticketType: "VIP",
      ticketName: "Viewer User",
      ticketScanned: true,
      isOnWaitlist: true,
      waitlistPosition: 4,
      isNotified: true,
      allowAdmittingStandby: true,
    });
  });
});
