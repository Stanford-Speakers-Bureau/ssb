import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockModule } from "@/tests/helpers/scoped-module-mock";

type SessionUser = {
  email: string;
  displayName: string;
  eduPersonAffiliation: string[];
  eduPersonScopedAffiliation: string[];
};

type QueueMap = Record<string, unknown[]>;

const TEST_EVENT_ID = "00000000-0000-4000-8000-000000000001";
const TEST_TICKET_ID = "00000000-0000-4000-8000-000000000002";
const TEST_QUESTION_ID = "00000000-0000-4000-8000-000000000003";

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
  events: table("events", [
    "id",
    "route",
    "name",
    "startTimeDate",
    "endTimeDate",
    "doorsOpen",
    "questionsEnabled",
    "questionsRankingsHidden",
  ]),
  tickets: table("tickets", [
    "id",
    "eventId",
    "email",
    "type",
    "name",
    "createdAt",
    "scanned",
  ]),
  waitlist: table("waitlist", ["eventId", "email", "referral"]),
  suggest: table("suggest", ["id", "email", "speaker"]),
  votes: table("votes", ["speakerId", "email"]),
  roles: table("roles", ["email", "roles"]),
  eventQuestions: table("eventQuestions", [
    "id",
    "eventId",
    "email",
    "question",
    "approved",
    "hidden",
    "duplicate",
    "votes",
    "createdAt",
  ]),
  eventQuestionVotes: table("eventQuestionVotes", [
    "id",
    "questionId",
    "email",
  ]),
};

const defaultUser: SessionUser = {
  email: "student@stanford.edu",
  displayName: "Stanford Student",
  eduPersonAffiliation: ["student"],
  eduPersonScopedAffiliation: ["student@stanford.edu"],
};

const defaultEvent = {
  id: TEST_EVENT_ID,
  name: "Test Event",
  route: "test-event",
  startTimeDate: new Date("2099-01-01T20:00:00.000Z"),
  endTimeDate: new Date("2099-01-01T22:00:00.000Z"),
  doorsOpen: new Date("2099-01-01T19:00:00.000Z"),
  venue: "Memorial Auditorium",
  venueLink: "https://example.com/venue",
  desc: "A test event",
  releaseDate: null,
  ticketingDate: null,
  standbyEnabled: false,
  tagline: "A big conversation",
  imgVersion: 1,
  referralsEnabled: true,
  ticketingRoles: ["student"],
  questionsEnabled: true,
  questionsRankingsHidden: false,
};

const state = {
  user: null as SessionUser | null,
  roleNames: [] as string[],
  roleRows: [] as Array<{ roles: string | null } | null>,
  rateLimitResponse: null as Response | null,
  availableTickets: {
    publicSold: 12,
    available: 38,
    maxPublic: 50,
    vipCount: 3,
  },
  eventRows: [] as Array<Record<string, unknown> | null>,
  ticketRows: [] as Array<Record<string, unknown> | null>,
  ticketLists: [] as Array<Record<string, unknown>[]>,
  suggestRows: [] as Array<Array<{ speaker: string | null }>>,
  questionRows: [] as Array<Array<Record<string, unknown>>>,
  questionVoteRows: [] as Array<Array<Record<string, unknown>>>,
  eventQuestionRows: [] as Array<Record<string, unknown> | null>,
  referralValidation: { ok: true, referral: null } as
    | { ok: true; referral: string | null }
    | { ok: false; message: string },
  ticketingEligible: true,
  lifecycleState: "open",
  cancellationClaims: null as null | { email: string; ticketId: string },
  executeRows: [] as Array<unknown>,
  insertReturning: {} as QueueMap,
  inserted: [] as Array<{ table: string; values: unknown }>,
  updated: [] as Array<{ table: string; values: unknown }>,
  deleted: [] as string[],
  emailJobs: [] as Array<unknown>,
  mailingListMembers: [] as Array<unknown>,
  auditEvents: [] as Array<unknown>,
  analyticsEvents: [] as Array<unknown>,
  afterCallbacks: [] as Array<() => Promise<void> | void>,
};

function resetState() {
  state.user = null;
  state.roleNames = [];
  state.roleRows = [];
  state.rateLimitResponse = null;
  state.availableTickets = {
    publicSold: 12,
    available: 38,
    maxPublic: 50,
    vipCount: 3,
  };
  state.eventRows = [];
  state.ticketRows = [];
  state.ticketLists = [];
  state.suggestRows = [];
  state.questionRows = [];
  state.questionVoteRows = [];
  state.eventQuestionRows = [];
  state.referralValidation = { ok: true, referral: null };
  state.ticketingEligible = true;
  state.lifecycleState = "open";
  state.cancellationClaims = null;
  state.executeRows = [];
  state.insertReturning = {};
  state.inserted = [];
  state.updated = [];
  state.deleted = [];
  state.emailJobs = [];
  state.mailingListMembers = [];
  state.auditEvents = [];
  state.analyticsEvents = [];
  state.afterCallbacks = [];
}

function insertReturning(tableName: string) {
  const queue = state.insertReturning[tableName] ?? [];
  if (queue.length > 0) {
    const next = queue.shift();
    return Array.isArray(next) ? next : [next];
  }
  return [{ id: `${tableName}-inserted` }];
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
          return Promise.resolve(insertReturning(tableName));
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
      const chain = {
        where() {
          return makeThenable({
            returning: () => Promise.resolve([]),
          });
        },
        returning: () => Promise.resolve([]),
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

const db = {
  query: {
    roles: {
      findFirst: mock(async () => takeQueue(state.roleRows, null)),
    },
    events: {
      findFirst: mock(async () => takeQueue(state.eventRows, defaultEvent)),
    },
    tickets: {
      findFirst: mock(async () => takeQueue(state.ticketRows, null)),
      findMany: mock(async () => takeQueue(state.ticketLists, [])),
    },
    waitlist: {
      findFirst: mock(async () => null),
      findMany: mock(async () => []),
    },
    suggest: {
      findMany: mock(async () => takeQueue(state.suggestRows, [])),
    },
    eventQuestions: {
      findFirst: mock(async () => takeQueue(state.eventQuestionRows, null)),
      findMany: mock(async () => takeQueue(state.questionRows, [])),
    },
    eventQuestionVotes: {
      findFirst: mock(async () => takeQueue(state.eventQuestionRows, null)),
      findMany: mock(async () => takeQueue(state.questionVoteRows, [])),
    },
  },
  insert: mock(dbInsert),
  update: mock(dbUpdate),
  delete: mock(dbDelete),
  execute: mock(async () => state.executeRows.shift() ?? []),
};

await mockModule("next/server", () => ({
  NextResponse: {
    json(body: unknown, init?: ResponseInit) {
      return Response.json(body, init);
    },
  },
  after(callback: () => Promise<void> | void) {
    state.afterCallbacks.push(callback);
  },
}));

await mockModule("@ssb/db", () => ({
  ...tables,
  db,
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  or: (...conditions: unknown[]) => ({ op: "or", conditions }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

await mockModule("@/app/lib/auth", () => ({
  getSessionUser: mock(async () => state.user),
  getRoleNamesForEmail: mock(async () => state.roleNames),
}));

await mockModule("@/app/lib/supabase", () => ({
  getAvailablePublicTickets: mock(async () => state.availableTickets),
  updateReferralRecords: mock(async (eventId: string, email: string) => {
    state.auditEvents.push({ action: "referral.update", eventId, email });
  }),
}));

await mockModule("@/app/lib/eventTime", () => ({
  isEventOver: mock(() => false),
}));

await mockModule("@/app/lib/validation", () => ({
  isValidUUID: (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(id),
}));

await mockModule("@/app/lib/constants", () => ({
  SUGGEST_MESSAGES: {
    ERROR_GENERIC: "Something went wrong. Please try again.",
    ERROR_MISSING_SPEAKER: "Please enter a speaker name.",
    ERROR_TOO_LONG: "Speaker name must be 500 characters or less.",
    ERROR_NOT_AUTHENTICATED:
      "Not authenticated. Please sign in with Stanford.",
    ERROR_BANNED: "You have been banned from making suggestions.",
  },
  QUESTION_MESSAGES: {
    ALREADY_VOTED: "You've already voted on this question.",
    NOT_VOTED: "You haven't voted on this question.",
    ERROR_GENERIC: "Something went wrong. Please try again.",
    ERROR_MISSING: "Please enter a question.",
    ERROR_TOO_SHORT: "Question must be at least 4 characters.",
    ERROR_TOO_LONG: "Question must be 280 characters or less.",
    ERROR_NOT_AUTHENTICATED:
      "Not authenticated. Please sign in with Stanford.",
    ERROR_BANNED: "You have been banned from submitting questions.",
    ERROR_LIFECYCLE_CLOSED: "Question submissions have closed - doors are open!",
    ERROR_EVENT_NOT_FOUND: "Event not found.",
    ERROR_QUESTION_NOT_FOUND: "Question not found.",
    ERROR_DUPLICATE: "You've already suggested this question.",
  },
}));

await mockModule("@/app/lib/audit", () => ({
  logAuditEvent: mock(async (event: unknown) => {
    state.auditEvents.push(event);
  }),
}));

await mockModule("@/app/lib/mailing-list", () => ({
  recordMailingListMember: mock(async (member: unknown) => {
    state.mailingListMembers.push(member);
  }),
}));

await mockModule("@/app/lib/cancellation-links", () => ({
  verifyCancellationToken: mock(async () => state.cancellationClaims),
}));

await mockModule("@/app/lib/ratelimit", () => ({
  checkRateLimit: mock(async () => state.rateLimitResponse),
  ticketRatelimit: {},
  suggestRatelimit: {},
  questionRatelimit: {},
  questionVoteRatelimit: {},
}));

await mockModule("@/app/lib/email-jobs", () => ({
  createCancellationEmailJob: (payload: unknown) => ({
    type: "cancellation",
    payload,
  }),
  createTicketEmailJob: (payload: unknown) => ({ type: "ticket", payload }),
  enqueueEmailJob: mock(async (job: unknown) => {
    state.emailJobs.push(job);
    return true;
  }),
  processEmailJob: mock(async (job: unknown) => {
    state.emailJobs.push(job);
  }),
}));

await mockModule("@/app/lib/referrals", () => ({
  sanitizeStoredReferral: mock(async () => null),
  validateReferralInput: mock(async () => state.referralValidation),
}));

await mockModule("@/app/lib/ticketingRoles", () => ({
  getRoleIneligiblePayload: (allowedRoles: string[]) => ({
    error: "Role ineligible",
    code: "ticketing_role_ineligible",
    allowedRoles,
  }),
  isTicketingEligible: mock(() => state.ticketingEligible),
  resolveTicketingRoles: (roles: string[] | null | undefined) =>
    roles?.length ? roles : ["student"],
}));

await mockModule("@/app/lib/posthog-server", () => ({
  captureServerEvent: mock((event: unknown) => {
    state.analyticsEvents.push(event);
  }),
  getPostHogClient: () => ({
    capture: (event: unknown) => state.analyticsEvents.push(event),
    flush: async () => {},
  }),
}));

await mockModule("@/app/events/[eventID]/questions/lifecycle", () => ({
  getQuestionsLifecycleState: mock(() => state.lifecycleState),
}));

const sessionRoute = await import("../auth/session/route");
const ticketRoute = await import("../tickets/route");
const suggestRoute = await import("../suggest/route");
const questionsRoute = await import("../events/[eventID]/questions/route");
const questionVoteRoute = await import(
  "../events/[eventID]/questions/[questionID]/vote/route"
);

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

function eventParams(eventID = "test-event") {
  return { params: Promise.resolve({ eventID }) };
}

function questionParams(
  eventID = "test-event",
  questionID = TEST_QUESTION_ID,
) {
  return { params: Promise.resolve({ eventID, questionID }) };
}

beforeEach(() => {
  resetState();
});

describe("public auth and ticket flows", () => {
  test("reports the logged-in session identity used by the web app", async () => {
    state.user = defaultUser;

    const { status, body } = await readJson(await sessionRoute.GET());

    expect(status).toBe(200);
    expect(body).toEqual({
      authenticated: true,
      distinctId: "student@stanford.edu",
    });
  });

  test("serves public ticket counts without requiring a session", async () => {
    const { status, body } = await readJson(
      await ticketRoute.GET(
        new Request(
          `https://web.test/api/tickets?count=true&eventId=${TEST_EVENT_ID}`,
        ),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      count: 12,
      available: 38,
      maxPublic: 50,
      vipCount: 3,
    });
  });

  test("rejects ticket creation when the user is signed out", async () => {
    const { status, body } = await readJson(
      await ticketRoute.POST(
        jsonRequest("https://web.test/api/tickets", {
          event_id: TEST_EVENT_ID,
        }),
      ),
    );

    expect(status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in.");
  });

  test("creates a standard ticket through the atomic ticket RPC", async () => {
    state.user = defaultUser;
    state.executeRows = [
      [
        {
          create_ticket_with_name: {
            success: true,
            ticket_id: TEST_TICKET_ID,
          },
        },
      ],
    ];

    const { status, body } = await readJson(
      await ticketRoute.POST(
        jsonRequest("https://web.test/api/tickets", {
          event_id: TEST_EVENT_ID,
          referral: "friend-code",
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      ticketId: TEST_TICKET_ID,
      ticketName: "Stanford Student",
      ticketType: "STANDARD",
    });
    expect(state.emailJobs).toHaveLength(1);
    expect(state.afterCallbacks).toHaveLength(3);
    expect(state.analyticsEvents).toHaveLength(1);
  });

  test("cancels the current user's ticket and queues the cancellation email", async () => {
    state.user = defaultUser;
    state.ticketRows = [
      {
        id: TEST_TICKET_ID,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        name: "Stanford Student",
        type: "STANDARD",
      },
    ];
    state.executeRows = [
      [
        {
          cancel_ticket_and_promote: {
            success: true,
            cancelled_ticket_id: TEST_TICKET_ID,
            promoted: false,
          },
        },
      ],
    ];

    const { status, body } = await readJson(
      await ticketRoute.DELETE(
        jsonRequest("https://web.test/api/tickets", {
          event_id: TEST_EVENT_ID,
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "Ticket cancelled successfully!",
    });
    expect(state.emailJobs).toHaveLength(1);
    expect(state.analyticsEvents).toHaveLength(1);
  });
});

describe("public suggestion and event-question flows", () => {
  test("rejects speaker suggestions when the user is signed out", async () => {
    const { status, body } = await readJson(
      await suggestRoute.POST(
        jsonRequest("https://web.test/api/suggest", {
          speaker: "Ada Lovelace",
        }),
      ),
    );

    expect(status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in with Stanford.");
  });

  test("submits unique speaker suggestions and creates initial votes", async () => {
    state.user = defaultUser;
    state.suggestRows = [[{ speaker: "Ada Lovelace" }]];
    state.insertReturning.suggest = [
      { id: "suggestion-one" },
      { id: "suggestion-two" },
    ];

    const { status, body } = await readJson(
      await suggestRoute.POST(
        jsonRequest("https://web.test/api/suggest", {
          speaker: "ada lovelace, grace hopper, GRACE HOPPER",
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(state.inserted).toEqual([
      {
        table: "suggest",
        values: {
          email: "student@stanford.edu",
          speaker: "Grace Hopper",
          approved: false,
          reviewed: false,
          votes: 0,
        },
      },
      {
        table: "votes",
        values: {
          speakerId: "suggestion-one",
          email: "student@stanford.edu",
        },
      },
    ]);
    expect(state.mailingListMembers).toEqual([
      { email: "student@stanford.edu", source: "suggest" },
    ]);
  });

  test("lists approved event questions with current user's vote ids", async () => {
    state.user = defaultUser;
    state.questionRows = [[
      {
        id: TEST_QUESTION_ID,
        question: "What should students read first?",
        votes: 4,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]];
    state.questionVoteRows = [[{ questionId: TEST_QUESTION_ID }]];

    const { status, body } = await readJson(
      await questionsRoute.GET(
        new Request("https://web.test/api/events/test-event/questions"),
        eventParams(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      userVotedIds: [TEST_QUESTION_ID],
      lifecycleState: "open",
      rankingsHidden: false,
    });
    expect(body.questions).toEqual([
      {
        id: TEST_QUESTION_ID,
        question: "What should students read first?",
        rank: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  test("submits an event question and records the submitter's initial vote", async () => {
    state.user = defaultUser;
    state.roleRows = [null];
    state.eventQuestionRows = [null];
    state.insertReturning.eventQuestions = [{ id: TEST_QUESTION_ID }];

    const { status, body } = await readJson(
      await questionsRoute.POST(
        jsonRequest("https://web.test/api/events/test-event/questions", {
          question: "  What should we ask next?\n",
        }),
        eventParams(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ success: true, id: TEST_QUESTION_ID });
    expect(state.inserted).toEqual([
      {
        table: "eventQuestions",
        values: {
          eventId: TEST_EVENT_ID,
          email: "student@stanford.edu",
          question: "What should we ask next?",
        },
      },
      {
        table: "eventQuestionVotes",
        values: {
          questionId: TEST_QUESTION_ID,
          email: "student@stanford.edu",
        },
      },
    ]);
    expect(state.mailingListMembers).toEqual([
      { email: "student@stanford.edu", source: "event_question" },
    ]);
  });

  test("casts a vote on an approved event question", async () => {
    state.user = defaultUser;
    state.eventQuestionRows = [{ id: TEST_QUESTION_ID }, null];

    const { status, body } = await readJson(
      await questionVoteRoute.POST(
        new Request(
          `https://web.test/api/events/test-event/questions/${TEST_QUESTION_ID}/vote`,
          { method: "POST" },
        ),
        questionParams(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(state.inserted).toContainEqual({
      table: "eventQuestionVotes",
      values: {
        questionId: TEST_QUESTION_ID,
        email: "student@stanford.edu",
      },
    });
    expect(state.mailingListMembers).toEqual([
      { email: "student@stanford.edu", source: "event_question_vote" },
    ]);
  });
});
