import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { mockModule } from "@/tests/helpers/scoped-module-mock";

import { captureSesFetch } from "../helpers/ses-capture";
import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  grantRole,
  makeEvent,
  makeTicket,
  registerCleanup,
  testEmail,
} from "../helpers/factories";

const actor = "integration-admin@it.test";

class TestNextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): TestNextResponse {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new TestNextResponse(JSON.stringify(body), { ...init, headers });
  }
}

await mockModule("next/server", () => ({
  NextRequest: Request,
  NextResponse: TestNextResponse,
  after: (callback: () => unknown) => Promise.resolve(callback()),
}));

await mockModule("@/app/lib/auth", () => ({
  getSessionUser: async () => ({ email: actor }),
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  getFeeWaiverEmailSetForEmails: async () => new Set<string>(),
  hasFeeWaiverForEmail: async () => false,
}));

await mockModule("@/app/lib/permissions", () => ({
  requirePermission: async () => ({ authorized: true, email: actor }),
  requireAnyPermission: async () => ({ authorized: true, email: actor }),
}));

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

async function loadTicketsRoute() {
  return import("@/app/api/tickets/route");
}

integration("admin tickets route against Postgres", () => {
  afterEach(async () => {
    process.env.DISABLE_EMAIL = "true";
    await cleanup();
  });
  afterAll(closeTestDatabase);

  test("GET returns numeric ticket statistics from real rows", async () => {
    const event = await makeEvent({ capacity: 10 });
    await makeTicket({ eventId: event.id, type: "STANDARD", scanned: true });
    await makeTicket({ eventId: event.id, type: "STANDARD" });
    await makeTicket({ eventId: event.id, type: "VIP" });
    await makeTicket({ eventId: event.id, type: "EXTERNAL" });
    await makeTicket({ eventId: event.id, type: "STANDBY" });

    const { GET } = await loadTicketsRoute();
    const response = await GET(
      new Request(`http://localhost/api/tickets?eventId=${event.id}&limit=2`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      total: 5,
      scannedCount: 1,
      unscannedCount: 4,
      filteredCount: 5,
      standardCount: 2,
      vipCount: 1,
      externalCount: 1,
      standbyCount: 1,
      limit: 2,
      offset: 0,
    });
    expect(body.tickets).toHaveLength(2);
  });

  for (const [action, label] of [
    ["sendDayOfReminders", "day-of"],
    ["sendEarlyReminders", "early"],
  ] as const) {
    test(`${label} reminder batches send MIME and suppress hard-blocked recipients`, async () => {
      const sql = getTestDatabase();
      const event = await makeEvent({ capacity: 5 });
      const allowedEmail = testEmail(`${label}-allowed`);
      const blockedEmail = testEmail(`${label}-blocked`);
      const allowed = await makeTicket({
        eventId: event.id,
        email: allowedEmail,
      });
      const blocked = await makeTicket({
        eventId: event.id,
        email: blockedEmail,
      });
      await grantRole(blockedEmail, "email_suppression");
      registerCleanup(() => sql`delete from audit_logs where actor = ${actor}`);

      process.env.DISABLE_EMAIL = "false";
      const capture = captureSesFetch();
      try {
        const { PATCH } = await loadTicketsRoute();
        const response = await PATCH(
          new Request(`http://localhost/api/tickets?eventId=${event.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action,
              ticketIds: [allowed.id, blocked.id],
              auditBatchId: `${label}-batch`,
            }),
          }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
          success: true,
          sent: 1,
          failed: 0,
          suppressed: 1,
          total: 2,
        });
        expect(capture.messages).toHaveLength(1);
        expect(capture.messages[0]?.rawMime).toContain(allowedEmail);
        expect(capture.messages[0]?.rawMime).not.toContain(blockedEmail);
      } finally {
        capture.restore();
      }
    });
  }
});
