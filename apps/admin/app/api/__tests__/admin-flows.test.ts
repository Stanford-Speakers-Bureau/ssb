import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockModule } from "@/tests/helpers/scoped-module-mock";

type SessionUser = {
  email: string;
};

type PermissionResult = {
  authorized: boolean;
  error?: string;
  email?: string;
  adminClient?: unknown;
};

type QueueMap = Record<string, unknown[]>;

const EVENT_ID = "00000000-0000-4000-8000-000000000101";
const TICKET_ID = "00000000-0000-4000-8000-000000000102";
const SUGGESTION_ID = "00000000-0000-4000-8000-000000000103";
const QUESTION_ID = "00000000-0000-4000-8000-000000000104";

function table(name: string, columns: string[]) {
  return Object.fromEntries([
    ["__table", name],
    ...columns.map((column) => [column, `${name}.${column}`]),
  ]);
}

function takeQueue<T>(queue: T[], fallback: T): T {
  return queue.length > 0 ? queue.shift()! : fallback;
}

function makeThenable<T extends Record<string, unknown>>(
  chain: T,
  value: unknown = undefined,
) {
  return Object.assign(chain, {
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(value).then(resolve, reject);
    },
  });
}

const tables = {
  auditLogs: table("auditLogs", ["id"]),
  canceledTickets: table("canceledTickets", ["eventId", "createdAt", "canceledAt"]),
  emailCampaigns: table("emailCampaigns", ["id", "createdAt"]),
  eventFeedback: table("eventFeedback", [
    "id",
    "eventId",
    "ticketId",
    "score",
    "comment",
    "updatedAt",
  ]),
  eventQuestions: table("eventQuestions", [
    "id",
    "eventId",
    "email",
    "question",
    "approved",
    "hidden",
    "duplicate",
  ]),
  eventQuestionVotes: table("eventQuestionVotes", ["questionId", "email"]),
  events: table("events", [
    "id",
    "name",
    "route",
    "live",
    "standbyEnabled",
    "identityVerificationEnabled",
    "allowAdmittingStandby",
    "eventId",
  ]),
  notify: table("notify", ["speakerId", "email"]),
  roles: table("roles", ["email", "roles"]),
  suggest: table("suggest", ["id", "email", "speaker", "votes"]),
  tickets: table("tickets", [
    "id",
    "eventId",
    "email",
    "name",
    "title",
    "type",
    "createdAt",
    "scanned",
    "scanTime",
    "referral",
  ]),
  userProfiles: table("userProfiles", ["email"]),
  votes: table("votes", ["speakerId", "email"]),
  waitlist: table("waitlist", ["eventId"]),
  walletVoidedPasses: table("walletVoidedPasses", ["serialNumber"]),
};

const adminClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      remove: async () => ({ error: null }),
    }),
  },
};

const adminUser: SessionUser = {
  email: "admin@stanford.edu",
};

const savedEvent = {
  id: EVENT_ID,
  name: "Admin Managed Event",
  desc: "Event description",
  tagline: "Big ideas",
  venue: "Memorial Auditorium",
  venueLink: "https://example.com/venue",
  address: "450 Jane Stanford Way",
  latitude: "37.4275",
  longitude: "-122.1697",
  route: "admin-managed-event",
  priority: null,
  capacity: 100,
  tickets: 10,
  reserved: 5,
  releaseDate: null,
  ticketingDate: null,
  startTimeDate: new Date("2099-02-01T20:00:00.000Z"),
  endTimeDate: new Date("2099-02-01T22:00:00.000Z"),
  doorsOpen: new Date("2099-02-01T19:00:00.000Z"),
  hideTicketingDate: false,
  referralsEnabled: true,
  standbyEnabled: false,
  identityVerificationEnabled: true,
  allowAdmittingStandby: false,
  bannerEligible: true,
  externalTicketingEnabled: false,
  externalTicketingUrl: null,
  livestream: null,
  ticketingRoles: ["student"],
  img: null,
  mobileImg: null,
  appleWalletImg: null,
  imgVersion: 1,
};

const ticketWithEvent = {
  id: TICKET_ID,
  email: "student@stanford.edu",
  name: "New Name",
  title: null,
  type: "STANDARD",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  scanned: false,
  scanTime: null,
  referral: null,
  eventId: EVENT_ID,
  event: {
    id: EVENT_ID,
    name: "Admin Managed Event",
    route: "admin-managed-event",
    startTimeDate: new Date("2099-02-01T20:00:00.000Z"),
    endTimeDate: new Date("2099-02-01T22:00:00.000Z"),
  },
};

const state = {
  user: null as SessionUser | null,
  permissionResult: null as PermissionResult | null,
  permissionCalls: [] as Array<{ action: string | string[]; eventId?: string | null }>,
  eventRows: [] as Array<Record<string, unknown> | null>,
  ticketRows: [] as Array<Record<string, unknown> | null>,
  ticketLists: [] as Array<Record<string, unknown>[]>,
  notifyLists: [] as Array<Record<string, unknown>[]>,
  suggestRows: [] as Array<Record<string, unknown> | null>,
  eventQuestionRows: [] as Array<Record<string, unknown> | null>,
  selectRows: [] as Array<unknown[]>,
  executeRows: [] as Array<unknown>,
  insertReturning: {} as QueueMap,
  updateReturning: {} as QueueMap,
  inserted: [] as Array<{ table: string; values: unknown }>,
  updated: [] as Array<{ table: string; values: unknown }>,
  deleted: [] as string[],
  auditEvents: [] as Array<unknown>,
  walletPushes: [] as Array<unknown>,
  emailSends: [] as Array<{ type: string; payload: unknown }>,
  mailingListMembers: [] as Array<unknown>,
  sendFailures: [] as Array<unknown>,
  adminSuggestions: [] as Array<unknown>,
  adminQuestions: [] as Array<unknown>,
  unsubscribedResult: null as null | { kept: string[]; skipped: string[] },
  suppressionResult: null as null | { sendable: string[]; suppressed: string[] },
};

function resetState() {
  state.user = null;
  state.permissionResult = null;
  state.permissionCalls = [];
  state.eventRows = [];
  state.ticketRows = [];
  state.ticketLists = [];
  state.notifyLists = [];
  state.suggestRows = [];
  state.eventQuestionRows = [];
  state.selectRows = [];
  state.executeRows = [];
  state.insertReturning = {};
  state.updateReturning = {};
  state.inserted = [];
  state.updated = [];
  state.deleted = [];
  state.auditEvents = [];
  state.walletPushes = [];
  state.emailSends = [];
  state.mailingListMembers = [];
  state.sendFailures = [];
  state.adminSuggestions = [];
  state.adminQuestions = [];
  state.unsubscribedResult = null;
  state.suppressionResult = null;
}

function currentPermission(): PermissionResult {
  return state.permissionResult ?? {
    authorized: true,
    email: adminUser.email,
    adminClient,
  };
}

function queuedReturning(queueMap: QueueMap, tableName: string) {
  const queue = queueMap[tableName] ?? [];
  if (queue.length > 0) {
    const next = queue.shift();
    return Array.isArray(next) ? next : [next];
  }
  return [];
}

function dbInsert(target: { __table?: string }) {
  const tableName = target.__table ?? "unknown";
  return {
    values(values: unknown) {
      state.inserted.push({ table: tableName, values });
      const chain = {
        onConflictDoNothing() {
          return makeThenable(chain);
        },
        returning() {
          return Promise.resolve(queuedReturning(state.insertReturning, tableName));
        },
      };
      return makeThenable(chain);
    },
  };
}

function dbUpdate(target: { __table?: string }) {
  const tableName = target.__table ?? "unknown";
  return {
    set(values: unknown) {
      state.updated.push({ table: tableName, values });
      const whereChain = {
        returning() {
          return Promise.resolve(queuedReturning(state.updateReturning, tableName));
        },
      };
      const chain = {
        where() {
          return makeThenable(whereChain);
        },
        returning() {
          return Promise.resolve(queuedReturning(state.updateReturning, tableName));
        },
      };
      return chain;
    },
  };
}

function dbDelete(target: { __table?: string }) {
  const tableName = target.__table ?? "unknown";
  return {
    where() {
      state.deleted.push(tableName);
      return makeThenable({});
    },
  };
}

function dbSelect() {
  const chain = {
    from() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    groupBy() {
      return Promise.resolve(state.selectRows.shift() ?? []);
    },
    limit() {
      return Promise.resolve(state.selectRows.shift() ?? []);
    },
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(state.selectRows.shift() ?? []).then(resolve, reject);
    },
  };
  return chain;
}

const db = {
  query: {
    canceledTickets: { findMany: mock(async () => []) },
    emailCampaigns: { findMany: mock(async () => []) },
    eventQuestions: {
      findFirst: mock(async () => takeQueue(state.eventQuestionRows, null)),
      findMany: mock(async () => []),
    },
    eventQuestionVotes: {
      findMany: mock(async () => []),
      findFirst: mock(async () => null),
    },
    events: {
      findFirst: mock(async () => takeQueue(state.eventRows, null)),
      findMany: mock(async () => []),
    },
    notify: {
      findMany: mock(async () => takeQueue(state.notifyLists, [])),
    },
    roles: {
      findFirst: mock(async () => null),
      findMany: mock(async () => []),
    },
    suggest: {
      findFirst: mock(async () => takeQueue(state.suggestRows, null)),
      findMany: mock(async () => []),
    },
    tickets: {
      findFirst: mock(async () => takeQueue(state.ticketRows, null)),
      findMany: mock(async () => takeQueue(state.ticketLists, [])),
    },
    userProfiles: {
      findMany: mock(async () => []),
    },
    waitlist: {
      findMany: mock(async () => []),
    },
  },
  insert: mock(dbInsert),
  update: mock(dbUpdate),
  delete: mock(dbDelete),
  select: mock(dbSelect),
  execute: mock(async () => state.executeRows.shift() ?? []),
  transaction: mock(async (callback: (tx: unknown) => unknown) => callback(db)),
};

await mockModule("next/server", () => ({
  NextResponse: {
    json(body: unknown, init?: ResponseInit) {
      return Response.json(body, init);
    },
  },
  connection: async () => {},
}));

await mockModule("@ssb/db", () => ({
  ...tables,
  db,
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  ne: (column: unknown, value: unknown) => ({ op: "ne", column, value }),
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  or: (...conditions: unknown[]) => ({ op: "or", conditions }),
  ilike: (column: unknown, value: unknown) => ({ op: "ilike", column, value }),
  inArray: (column: unknown, values: unknown[]) => ({
    op: "inArray",
    column,
    values,
  }),
  asc: (column: unknown) => ({ direction: "asc", column }),
  desc: (column: unknown) => ({ direction: "desc", column }),
  count: () => ({ aggregate: "count" }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

await mockModule("@/app/lib/auth", () => ({
  getSessionUser: mock(async () => state.user),
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  getFeeWaiverEmailSetForEmails: mock(async () => new Set<string>()),
  hasFeeWaiverForEmail: mock(async () => false),
}));

await mockModule("@/app/lib/permissions", () => ({
  requirePermission: mock(async (action: string, eventId?: string | null) => {
    state.permissionCalls.push({ action, eventId });
    return currentPermission();
  }),
  requireAnyPermission: mock(async (action: string[], eventId?: string | null) => {
    state.permissionCalls.push({ action, eventId });
    return currentPermission();
  }),
  requireActionAnyScope: mock(async (action: string) => {
    state.permissionCalls.push({ action });
    return currentPermission();
  }),
  getEffectivePermissions: mock(async () => []),
  permittedEventIdsForAction: mock(() => null),
  canUseActionForEvent: mock(() => true),
}));

await mockModule("@/app/lib/supabase", () => ({
  getAvailablePublicTickets: mock(async () => ({
    vipCount: 0,
    reserved: 10,
  })),
  getSignedImageUrl: mock(async (image: string) => `https://images.test/${image}`),
  getSupabaseClient: () => adminClient,
  serializeEvent: (event: Record<string, unknown>) => ({
    id: event.id,
    name: event.name,
    route: event.route,
    capacity: event.capacity,
    tickets: event.tickets,
    reserved: event.reserved,
    live: event.live ?? false,
    standby_enabled: event.standbyEnabled ?? false,
    identity_verification_enabled: event.identityVerificationEnabled ?? true,
    allow_admitting_standby: event.allowAdmittingStandby ?? false,
  }),
}));

await mockModule("@/app/lib/ticketingRoles", () => ({
  isTicketingRole: (value: string) =>
    ["student", "staff", "faculty", "alumni", "grad", "undergrad"].includes(
      value,
    ),
  resolveTicketingRoles: (values: string[]) =>
    values.length > 0 ? values : ["student"],
}));

await mockModule("@/app/lib/validation", () => ({
  hasUnsafeHeaderChars: (value: string) => /[\r\n]/.test(value),
  isValidAddress: (value: string | null) => !value || value.length <= 500,
  isValidAppleWalletImageExtension: (name: string) => name.endsWith(".png"),
  isValidCapacity: (value: string | null) => {
    if (!value) return true;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;
  },
  isValidDateString: (value: string | null) => !value || !Number.isNaN(new Date(value).getTime()),
  isValidEmail: (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254,
  isValidImageExtension: (name: string) =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(name),
  isValidImageSize: (size: number) => size > 0 && size <= 5 * 1024 * 1024,
  isValidLatitude: (value: string | null) => {
    if (!value) return true;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90;
  },
  isValidLongitude: (value: string | null) => {
    if (!value) return true;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180;
  },
  isValidRoute: (route: string | null) =>
    !route || (route.length <= 100 && /^[a-z0-9_-]+$/.test(route)),
  isValidUrl: (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
  isValidUUID: (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(id),
}));

await mockModule("@/app/lib/audit", () => ({
  logAuditEvent: mock(async (event: unknown) => {
    state.auditEvents.push(event);
  }),
}));

await mockModule("@/app/lib/wallet-push", () => ({
  pushWalletUpdate: mock(async (...args: unknown[]) => {
    state.walletPushes.push(args);
  }),
}));

await mockModule("@/app/lib/waitlist", () => ({
  pullFromWaitlist: mock(async (...args: unknown[]) => {
    state.auditEvents.push({ action: "waitlist.pull.mock", args });
  }),
  removeWaitlistEntryForEmail: mock(async () => {}),
}));

await mockModule("@/app/lib/mailing-list", () => ({
  filterUnsubscribedHierarchical: mock(async (emails: string[]) =>
    state.unsubscribedResult ?? { kept: emails, skipped: [] }
  ),
  recordMailingListMember: mock(async (member: unknown) => {
    state.mailingListMembers.push(member);
  }),
}));

await mockModule("@/app/lib/email-suppression", () => ({
  logSendFailures: mock(async (payload: unknown) => {
    state.sendFailures.push(payload);
  }),
  partitionBySuppression: mock(async (emails: string[]) =>
    state.suppressionResult ?? { sendable: emails, suppressed: [] }
  ),
}));

function recordEmail(type: string) {
  return mock(async (payload: unknown) => {
    state.emailSends.push({ type, payload });
  });
}

await mockModule("@/app/lib/email", () => ({
  sendCancellationEmail: recordEmail("cancellation"),
  sendClaimTicketEmail: recordEmail("claimTicket"),
  sendDayOfReminderEmail: recordEmail("dayOfReminder"),
  sendEarlyReminderEmail: recordEmail("earlyReminder"),
  sendEventAnnouncedEmail: recordEmail("announcement"),
  sendEventQuestionApprovedEmail: recordEmail("eventQuestionApproved"),
  sendStandbyLineEmail: recordEmail("standbyLine"),
  sendSuggestionApprovedEmail: recordEmail("suggestionApproved"),
  sendTicketEmail: recordEmail("ticket"),
  sendTicketsAvailableInEmail: recordEmail("ticketsAvailableIn"),
  sendTicketsAvailableNowEmail: recordEmail("ticketsAvailableNow"),
}));

await mockModule("@/app/suggest/data", () => ({
  getAdminSuggestions: mock(async () => ({ suggestions: state.adminSuggestions })),
}));

await mockModule("@/app/event-questions/data", () => ({
  getAdminEventQuestions: mock(async () => ({ questions: state.adminQuestions })),
}));

await mockModule("@/app/lib/affiliation", () => ({
  getHighestAffiliation: mock(() => "student"),
}));

const sessionRoute = await import("../auth/session/route");
const eventsRoute = await import("../events/route");
const bulkSendRoute = await import("../email/bulk-send/route");
const ticketLookupRoute = await import("../tickets/lookup/route");
const ticketsRoute = await import("../tickets/route");
const suggestionsRoute = await import("../suggestions/route");
const eventQuestionsRoute = await import("../event-questions/route");
const eventQuestionsToggleRoute = await import(
  "../event-questions/event-toggle/route"
);

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function eventForm(overrides: Record<string, string | string[]> = {}) {
  const fields: Record<string, string | string[]> = {
    name: "Admin Managed Event",
    desc: "Event description",
    tagline: "Big ideas",
    capacity: "100",
    tickets: "10",
    reserved: "5",
    venue: "Memorial Auditorium",
    venue_link: "https://example.com/venue",
    release_date: "",
    ticketing_date: "",
    start_time_date: "2099-02-01T12:00",
    end_time_date: "2099-02-01T14:00",
    doors_open: "2099-02-01T11:00",
    route: "admin-managed-event",
    priority: "",
    latitude: "37.4275",
    longitude: "-122.1697",
    address: "450 Jane Stanford Way",
    livestream: "",
    ticketing_roles: ["student"],
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else {
      form.set(key, value);
    }
  }
  return new Request("https://admin.test/api/events", {
    method: "POST",
    body: form,
  });
}

async function readJson(response: Response) {
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

beforeEach(() => {
  resetState();
});

describe("admin auth, events, and tickets", () => {
  test("reports an authenticated admin session", async () => {
    state.user = adminUser;

    const { status, body } = await readJson(await sessionRoute.GET());

    expect(status).toBe(200);
    expect(body).toEqual({ authenticated: true });
  });

  test("creates an event with normalized form data and an audit log", async () => {
    state.insertReturning.events = [savedEvent];

    const { status, body } = await readJson(
      await eventsRoute.POST(eventForm()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      event: {
        id: EVENT_ID,
        name: "Admin Managed Event",
        route: "admin-managed-event",
        image_url: null,
      },
    });
    expect(state.permissionCalls).toEqual([
      { action: "events.create", eventId: undefined },
    ]);
    expect(state.inserted[0]).toMatchObject({
      table: "events",
      values: {
        name: "Admin Managed Event",
        route: "admin-managed-event",
        capacity: 100,
        tickets: 10,
        reserved: 5,
        identityVerificationEnabled: true,
      },
    });
    expect(state.auditEvents).toHaveLength(1);
  });

  test("rejects event creation when external ticketing has no URL", async () => {
    const { status, body } = await readJson(
      await eventsRoute.POST(
        eventForm({
          external_ticketing_enabled: "true",
          external_ticketing_url: "",
        }),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toBe(
      "External ticketing URL is required when external ticketing is enabled.",
    );
    expect(state.inserted).toHaveLength(0);
  });

  test("sets one event live while clearing live from the rest", async () => {
    state.updateReturning.events = [{ ...savedEvent, live: true }];

    const { status, body } = await readJson(
      await eventsRoute.PATCH(
        jsonRequest("https://admin.test/api/events", {
          id: EVENT_ID,
          live: true,
        }, "PATCH"),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(state.updated).toEqual([
      { table: "events", values: { live: false } },
      { table: "events", values: { live: true } },
    ]);
    expect(state.auditEvents).toHaveLength(1);
  });

  test("does not delete an event that still has active tickets", async () => {
    state.eventRows = [{ name: "Admin Managed Event", img: null, mobileImg: null, appleWalletImg: null }];
    state.ticketRows = [{ id: TICKET_ID }];

    const { status, body } = await readJson(
      await eventsRoute.DELETE(
        jsonRequest("https://admin.test/api/events", { id: EVENT_ID }, "DELETE"),
      ),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Cannot delete an event with active tickets.");
    expect(state.deleted).toHaveLength(0);
  });

  test("looks up whether a user already has a ticket for an event", async () => {
    state.ticketRows = [{ id: TICKET_ID, type: "STANDARD", name: "Student" }];

    const { status, body } = await readJson(
      await ticketLookupRoute.GET(
        new Request(
          `https://admin.test/api/tickets/lookup?email=Student@Stanford.edu&eventId=${EVENT_ID}`,
        ),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      ticket: { id: TICKET_ID, type: "STANDARD", name: "Student" },
    });
    expect(state.permissionCalls).toEqual([
      { action: "tickets.view", eventId: EVENT_ID },
    ]);
  });

  test("edits a ticket holder name and refreshes wallet passes", async () => {
    state.ticketRows = [{ eventId: EVENT_ID }, ticketWithEvent];

    const { status, body } = await readJson(
      await ticketsRoute.PATCH(
        jsonRequest("https://admin.test/api/tickets", {
          id: TICKET_ID,
          action: "updateName",
          name: " New Name ",
        }, "PATCH"),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      ticket: {
        id: TICKET_ID,
        email: "student@stanford.edu",
        name: "New Name",
      },
    });
    expect(state.updated).toContainEqual({
      table: "tickets",
      values: { name: "New Name" },
    });
    expect(state.walletPushes).toHaveLength(1);
    expect(state.auditEvents).toHaveLength(1);
  });
});

describe("admin email, suggestions, and question moderation", () => {
  test("sends bulk announcement emails after dedupe and suppression checks", async () => {
    state.eventRows = [savedEvent];

    const { status, body } = await readJson(
      await bulkSendRoute.POST(
        jsonRequest("https://admin.test/api/email/bulk-send", {
          eventId: EVENT_ID,
          emails: ["Student@Stanford.edu ", "student@stanford.edu", "fan@example.com"],
          kind: "announcement",
          auditBatchId: "batch-1",
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      sent: 2,
      failed: 0,
      skippedHasTicket: 0,
      skippedOptedOut: 0,
      suppressed: 0,
    });
    expect(state.emailSends.map((send) => send.type)).toEqual([
      "announcement",
      "announcement",
    ]);
    expect(state.auditEvents).toHaveLength(1);
    expect(state.sendFailures).toHaveLength(1);
  });

  test("requires an ETA for ticketsAvailableIn bulk emails", async () => {
    const { status, body } = await readJson(
      await bulkSendRoute.POST(
        jsonRequest("https://admin.test/api/email/bulk-send", {
          eventId: EVENT_ID,
          emails: ["student@stanford.edu"],
          kind: "ticketsAvailableIn",
        }),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toBe(
      "approxTimeUntilAvailable is required when kind is 'ticketsAvailableIn'",
    );
    expect(state.emailSends).toHaveLength(0);
  });

  test("approves a speaker suggestion, audits it, and notifies the suggester", async () => {
    state.suggestRows = [{
      speaker: "Grace Hopper",
      email: "student@stanford.edu",
      approved: false,
    }];
    state.adminSuggestions = [{ id: SUGGESTION_ID, speaker: "Grace Hopper" }];

    const { status, body } = await readJson(
      await suggestionsRoute.POST(
        jsonRequest("https://admin.test/api/suggestions", {
          id: SUGGESTION_ID,
          action: "approve",
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      suggestions: state.adminSuggestions,
    });
    expect(state.updated).toContainEqual({
      table: "suggest",
      values: { reviewed: true, approved: true },
    });
    expect(state.emailSends).toEqual([
      {
        type: "suggestionApproved",
        payload: {
          email: "student@stanford.edu",
          speaker: "Grace Hopper",
          suggestionId: SUGGESTION_ID,
        },
      },
    ]);
    expect(state.auditEvents).toHaveLength(1);
  });

  test("approves an event question, audits it, and notifies the submitter", async () => {
    state.eventQuestionRows = [{
      id: QUESTION_ID,
      question: "What inspired this work?",
      email: "student@stanford.edu",
      approved: false,
      eventId: EVENT_ID,
    }];
    state.eventRows = [{ id: EVENT_ID, name: "Admin Managed Event", route: "admin-managed-event" }];
    state.adminQuestions = [{ id: QUESTION_ID, question: "What inspired this work?" }];

    const { status, body } = await readJson(
      await eventQuestionsRoute.POST(
        jsonRequest("https://admin.test/api/event-questions", {
          id: QUESTION_ID,
          action: "approve",
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      questions: state.adminQuestions,
    });
    expect(state.permissionCalls).toEqual([
      { action: "questions.manage", eventId: EVENT_ID },
    ]);
    expect(state.updated).toContainEqual({
      table: "eventQuestions",
      values: { reviewed: true, approved: true },
    });
    expect(state.emailSends).toEqual([
      {
        type: "eventQuestionApproved",
        payload: {
          email: "student@stanford.edu",
          question: "What inspired this work?",
          eventName: "Admin Managed Event",
          eventRoute: "admin-managed-event",
        },
      },
    ]);
  });

  test("toggles event question collection for an event", async () => {
    state.eventRows = [{
      id: EVENT_ID,
      name: "Admin Managed Event",
      questionsEnabled: false,
    }];
    state.adminQuestions = [];

    const { status, body } = await readJson(
      await eventQuestionsToggleRoute.PATCH(
        jsonRequest("https://admin.test/api/event-questions/event-toggle", {
          eventId: EVENT_ID,
          enabled: true,
        }, "PATCH"),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      enabled: true,
      questions: [],
    });
    expect(state.updated).toContainEqual({
      table: "events",
      values: { questionsEnabled: true },
    });
    expect(state.auditEvents).toHaveLength(1);
  });
});
