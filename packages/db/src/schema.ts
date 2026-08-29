import {
  pgTable,
  uuid,
  text,
  boolean,
  bigint,
  integer,
  timestamp,
  numeric,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { DEFAULT_TICKETING_ROLES } from "./ticketingRoles";

// ── Events ──────────────────────────────────────────────────────────────────
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    name: text("name"),
    capacity: bigint("capacity", { mode: "number" }).notNull().default(0),
    venue: text("venue"),
    reserved: bigint("reserved", { mode: "number" }).notNull().default(0),
    venueLink: text("venue_link"),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    startTimeDate: timestamp("start_time_date", { withTimezone: true }),
    endTimeDate: timestamp("end_time_date", { withTimezone: true }),
    doorsOpen: timestamp("doors_open", { withTimezone: true }),
    desc: text("desc"),
    img: text("img"),
    mobileImg: text("mobile_img"),
    appleWalletImg: text("apple_wallet_img"),
    route: text("route"),
    tagline: text("tagline"),
    tickets: bigint("tickets", { mode: "number" }).notNull().default(0),
    publicTicketsSold: bigint("public_tickets_sold", { mode: "number" })
      .notNull()
      .default(0),
    vipTicketsSold: bigint("vip_tickets_sold", { mode: "number" })
      .notNull()
      .default(0),
    standbyTicketsSold: bigint("standby_tickets_sold", { mode: "number" })
      .notNull()
      .default(0),
    live: boolean("live").notNull().default(false),
    scanned: bigint("scanned", { mode: "number" }).notNull().default(0),
    latitude: numeric("latitude").notNull().default("0"),
    longitude: numeric("longitude").notNull().default("0"),
    address: text("address").notNull().default(""),
    imgVersion: bigint("img_version", { mode: "number" }).notNull().default(1),
    ticketingDate: timestamp("ticketing_date", { withTimezone: true }),
    livestream: text("livestream"),
    title: text("title"),
    priority: text("priority"),
    ticketingRoles: text("ticketing_roles")
      .array()
      .notNull()
      .default([...DEFAULT_TICKETING_ROLES]),
    hideTicketingDate: boolean("hide_ticketing_date").notNull().default(false),
    waitlistChance: text("waitlist_chance").notNull().default("High"),
    standbyEnabled: boolean("standby_enabled").notNull().default(false),
    referralsEnabled: boolean("referrals_enabled").notNull().default(false),
    externalTicketingEnabled: boolean("external_ticketing_enabled")
      .notNull()
      .default(false),
    externalTicketingUrl: text("external_ticketing_url"),
    bannerEligible: boolean("banner_eligible").notNull().default(true),
    questionsEnabled: boolean("questions_enabled").notNull().default(false),
    questionsRankingsHidden: boolean("questions_rankings_hidden")
      .notNull()
      .default(false),
    identityVerificationEnabled: boolean("identity_verification_enabled")
      .notNull()
      .default(true),
    allowAdmittingStandby: boolean("allow_admitting_standby")
      .notNull()
      .default(false),
  },
  (t) => [
    index("events_route_idx").on(t.route),
    check(
      "events_ticketing_roles_nonempty",
      sql`cardinality(${t.ticketingRoles}) > 0`,
    ),
  ],
);

// ── Tickets ─────────────────────────────────────────────────────────────────
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email").notNull(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    referral: text("referral"),
    type: text("type").notNull().default("STANDARD"),
    scanned: boolean("scanned").notNull().default(false),
    scanTime: timestamp("scan_time", { withTimezone: true }),
    scanUser: text("scan_user"),
    scanEmail: text("scan_email"),
    name: text("name"),
    // Optional internal label for certain guests (e.g. "Keynote Speaker").
    // Admin-only: never shown on the public site, emails, or wallet passes.
    title: text("title"),
    // Bumped whenever a wallet-visible field changes, so the PassKit web
    // service can answer If-Modified-Since / passesUpdatedSince correctly.
    walletUpdatedAt: timestamp("wallet_updated_at", { withTimezone: true }),
  },
  (t) => [
    index("tickets_email_idx").on(t.email),
    index("tickets_event_id_idx").on(t.eventId),
    index("tickets_event_type_idx").on(t.eventId, t.type),
    index("tickets_event_lower_trim_email_idx").on(
      t.eventId,
      sql`lower(trim(${t.email}))`,
    ),
    index("tickets_referral_idx").on(t.referral),
    index("tickets_scanned_idx").on(t.scanned),
    uniqueIndex("tickets_event_email_unique").on(t.eventId, t.email),
  ],
);

// ── Wallet pass registrations (Apple PassKit web service) ───────────────────
// One row per (device, pass) the user has installed and asked us to keep
// updated. We push to push_token via APNs when the underlying ticket changes.
export const walletRegistrations = pgTable(
  "wallet_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    passTypeId: text("pass_type_id").notNull(),
    serialNumber: text("serial_number").notNull(),
    deviceLibraryId: text("device_library_id").notNull(),
    pushToken: text("push_token").notNull(),
  },
  (t) => [
    uniqueIndex("wallet_registrations_device_serial_unique").on(
      t.deviceLibraryId,
      t.serialNumber,
    ),
    index("wallet_registrations_serial_idx").on(t.serialNumber),
    index("wallet_registrations_device_idx").on(t.deviceLibraryId, t.passTypeId),
  ],
);

// ── Wallet voided-pass tombstones ───────────────────────────────────────────
// Cancelling a ticket hard-deletes the row, leaving the web service nothing to
// serve. We drop a tombstone here so an installed pass can still be fetched and
// shown as voided/CANCELLED (then pushed). The event row still exists, so the
// voided pass renders with real event info. Safe to prune after the pass's
// expiration date has passed.
export const walletVoidedPasses = pgTable(
  "wallet_voided_passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voidedAt: timestamp("voided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    serialNumber: text("serial_number").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    ticketType: text("ticket_type").notNull(),
    eventId: uuid("event_id"),
  },
  (t) => [uniqueIndex("wallet_voided_passes_serial_unique").on(t.serialNumber)],
);

// ── Waitlist ────────────────────────────────────────────────────────────────
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    referral: text("referral"),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    email: text("email").notNull(),
    position: bigint("position", { mode: "number" }).notNull(),
    name: text("name"),
  },
  (t) => [
    uniqueIndex("unique_waitlist_per_user").on(t.eventId, t.email),
    index("idx_waitlist_event_id").on(t.eventId),
    index("idx_waitlist_created_at").on(t.eventId, t.createdAt),
    index("idx_waitlist_position").on(t.eventId, t.position),
  ],
);

// ── Suggest ─────────────────────────────────────────────────────────────────
export const suggest = pgTable(
  "suggest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email"),
    speaker: text("speaker"),
    approved: boolean("approved").notNull().default(false),
    votes: bigint("votes", { mode: "number" }).notNull().default(0),
    reviewed: boolean("reviewed").notNull().default(false),
    duplicate: boolean("duplicate").notNull().default(false),
    spoke: boolean("spoke").notNull().default(false),
    // Where the suggestion's unique link redirects once the speaker has spoken.
    eventLink: text("event_link"),
  },
  (t) => [
    index("suggest_email_idx").on(t.email),
    index("suggest_reviewed_idx").on(t.reviewed),
    index("suggest_speaker_idx").on(t.speaker),
    index("suggest_votes_idx").on(t.votes),
    index("suggest_spoke_idx").on(t.spoke),
  ],
);

// ── Votes ───────────────────────────────────────────────────────────────────
export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    speakerId: uuid("speaker_id").references(() => suggest.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    email: text("email"),
  },
  (t) => [
    uniqueIndex("votes_email_speaker_unique").on(t.email, t.speakerId),
    index("votes_email_idx").on(t.email),
    index("votes_speaker_id_idx").on(t.speakerId),
  ],
);

// ── Event Questions ─────────────────────────────────────────────────────────
export const eventQuestions = pgTable(
  "event_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    email: text("email").notNull(),
    question: text("question").notNull(),
    approved: boolean("approved").notNull().default(false),
    reviewed: boolean("reviewed").notNull().default(false),
    duplicate: boolean("duplicate").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    votes: bigint("votes", { mode: "number" }).notNull().default(0),
  },
  (t) => [
    index("event_questions_event_id_idx").on(t.eventId),
    index("event_questions_event_public_idx").on(
      t.eventId,
      t.approved,
      t.hidden,
      t.votes,
    ),
    index("event_questions_reviewed_idx").on(t.reviewed),
    index("event_questions_email_idx").on(t.email),
    check(
      "event_questions_length_check",
      sql`char_length(trim(${t.question})) BETWEEN 4 AND 280`,
    ),
  ],
);

export const eventQuestionVotes = pgTable(
  "event_question_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => eventQuestions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    email: text("email").notNull(),
  },
  (t) => [
    uniqueIndex("event_question_votes_email_question_unique").on(
      t.email,
      t.questionId,
    ),
    index("event_question_votes_question_id_idx").on(t.questionId),
    index("event_question_votes_email_idx").on(t.email),
  ],
);

// ── Notify ──────────────────────────────────────────────────────────────────
export const notify = pgTable(
  "notify",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email").notNull(),
    speakerId: uuid("speaker_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (t) => [
    uniqueIndex("notify_email_speaker_unique").on(t.email, t.speakerId),
    index("notify_speaker_id_idx").on(t.speakerId),
  ],
);

// ── Referrals ───────────────────────────────────────────────────────────────
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventId: uuid("event_id")
      .notNull()
      .defaultRandom()
      .references(() => events.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    referralCode: text("referral_code"),
    count: bigint("count", { mode: "number" }).notNull().default(0),
  },
  (t) => [
    uniqueIndex("unique_event_referral").on(t.eventId, t.referralCode),
    index("referrals_event_id_idx").on(t.eventId),
  ],
);

// ── Roles ───────────────────────────────────────────────────────────────────
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email"),
    roles: text("roles"),
  },
  (t) => [index("roles_email_idx").on(t.email)],
);

// ── Permission Grants ────────────────────────────────────────────────────────
// Fine-grained, optionally event-scoped capabilities granted to a person by
// email. `action` is one of the PERMISSION_ACTIONS (see app/lib/permissions.ts).
// A NULL eventId means the grant applies to ALL events (and to global actions
// like suggestions.manage / events.create). The `admin` role in `roles` is a
// super-admin that bypasses these checks entirely.
export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email").notNull(),
    action: text("action").notNull(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    grantedBy: text("granted_by").notNull(),
  },
  (t) => [
    // Unique per (person, action, event). NULL eventId rows (all-events grants)
    // are treated as distinct by Postgres, so the grant API also dedupes them
    // explicitly before inserting.
    uniqueIndex("permission_grants_unique").on(t.email, t.action, t.eventId),
    index("permission_grants_email_idx").on(t.email),
    index("permission_grants_event_id_idx").on(t.eventId),
  ],
);

// ── User Profiles ────────────────────────────────────────────────────────────
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email").notNull(),
    uid: text("uid"),
    displayName: text("display_name").notNull(),
    eduPersonAffiliation: text("edu_person_affiliation")
      .array()
      .notNull()
      .default([]),
    eduPersonScopedAffiliation: text("edu_person_scoped_affiliation")
      .array()
      .notNull()
      .default([]),
  },
  (t) => [uniqueIndex("user_profiles_email_unique").on(t.email)],
);

// ── Event Feedback ──────────────────────────────────────────────────────────
export const eventFeedback = pgTable(
  "event_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    email: text("email").notNull(),
    score: integer("score").notNull(),
    comment: text("comment"),
    submittedVia: text("submitted_via").notNull().default("session"),
  },
  (t) => [
    uniqueIndex("event_feedback_ticket_id_unique").on(t.ticketId),
    index("event_feedback_event_id_idx").on(t.eventId),
    index("event_feedback_email_idx").on(t.email),
    index("event_feedback_score_idx").on(t.score),
    check(
      "event_feedback_score_check",
      sql`${t.score} >= 1 AND ${t.score} <= 10`,
    ),
    check(
      "event_feedback_submitted_via_check",
      sql`${t.submittedVia} in ('session', 'signed_link')`,
    ),
  ],
);

// ── Canceled-ticket archive ─────────────────────────────────────────────────
// Canceling a ticket hard-deletes the `tickets` row (see the
// cancel_ticket_and_promote RPC), so the live table keeps no trace of who
// bought-then-bailed and "show-up rate by purchase timing" silently drops them.
// We snapshot the row here first — original purchase time + cancel time — so
// analytics can count cancellations without these rows re-entering any
// capacity / scan / email query (same containment as walletVoidedPasses).
export const canceledTickets = pgTable(
  "canceled_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // id of the now-deleted ticket row. Not a FK (the row is gone); unique so a
    // re-run of the audit-log backfill can't duplicate a cancellation.
    originalTicketId: uuid("original_ticket_id"),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    email: text("email").notNull(),
    name: text("name"),
    type: text("type"),
    referral: text("referral"),
    // When the ticket was originally purchased — the x-axis for purchase timing.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    // When it was canceled.
    canceledAt: timestamp("canceled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 'live' = captured by the cancel RPC; 'backfill' = reconstructed from audit logs.
    source: text("source").notNull().default("live"),
  },
  (t) => [
    index("canceled_tickets_event_id_idx").on(t.eventId),
    index("canceled_tickets_created_at_idx").on(t.createdAt),
    uniqueIndex("canceled_tickets_original_ticket_id_unique").on(
      t.originalTicketId,
    ),
  ],
);

// ── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    source: text("source").notNull(),
    eventId: uuid("event_id"),
    eventName: text("event_name"),
    targetEmail: text("target_email"),
    metadata: text("metadata"),
  },
  (t) => [
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_actor_idx").on(t.actor),
    index("audit_logs_event_id_idx").on(t.eventId),
    index("audit_logs_target_email_idx").on(t.targetEmail),
  ],
);

// ── Email Campaigns ────────────────────────────────────────────────────────
export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    subject: text("subject").notNull(),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("draft"),
    audiences: text("audiences").notNull().default("[]"),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    includeHeroCard: boolean("include_hero_card").notNull().default(false),
    feedbackEventId: uuid("feedback_event_id").references(() => events.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    includeFeedbackPrompt: boolean("include_feedback_prompt")
      .notNull()
      .default(false),
    cancelCalloutEventId: uuid("cancel_callout_event_id").references(
      () => events.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    includeCancelCallout: boolean("include_cancel_callout")
      .notNull()
      .default(false),
    cancelCalloutPosition: text("cancel_callout_position")
      .notNull()
      .default("before"),
    cancelCalloutText: text("cancel_callout_text")
      .notNull()
      .default("Can't make it? [Please cancel] so someone else can attend."),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentBy: text("sent_by"),
    recipientCount: bigint("recipient_count", { mode: "number" }),
    failedCount: bigint("failed_count", { mode: "number" })
      .notNull()
      .default(0),
    sendBatchId: text("send_batch_id"),
    lastProcessedChunkIndex: integer("last_processed_chunk_index")
      .notNull()
      .default(-1),
    createdBy: text("created_by").notNull(),
    footerType: text("footer_type").notNull().default("event_unsubscribe"),
  },
  (t) => [
    index("email_campaigns_status_idx").on(t.status),
    index("email_campaigns_created_at_idx").on(t.createdAt),
  ],
);

// ── Mailing List ────────────────────────────────────────────────────────────
export const mailingList = pgTable(
  "mailing_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email").notNull(),
    displayEmail: text("display_email").notNull(),
    source: text("source").notNull(),
  },
  (t) => [
    uniqueIndex("mailing_list_email_unique").on(t.email),
    index("mailing_list_source_idx").on(t.source),
    index("mailing_list_created_at_idx").on(t.createdAt),
  ],
);

// ── Email Unsubscribes ──────────────────────────────────────────────────────
export const emailUnsubscribes = pgTable(
  "email_unsubscribes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email").notNull(),
    scope: text("scope").notNull(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    source: text("source").notNull(),
    reason: text("reason"),
    actor: text("actor").notNull(),
  },
  (t) => [
    index("email_unsubscribes_scope_event_idx").on(t.scope, t.eventId),
    check(
      "email_unsubscribes_scope_check",
      sql`${t.scope} in ('announce', 'event', 'newsletter')`,
    ),
    check(
      "email_unsubscribes_scope_event_check",
      sql`(${t.scope} = 'announce' AND ${t.eventId} IS NULL) OR (${t.scope} = 'newsletter' AND ${t.eventId} IS NULL) OR (${t.scope} = 'event' AND ${t.eventId} IS NOT NULL)`,
    ),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const eventsRelations = relations(events, ({ many }) => ({
  ticketList: many(tickets),
  waitlistList: many(waitlist),
  referralList: many(referrals),
  notifyList: many(notify),
  feedbackList: many(eventFeedback),
  campaignList: many(emailCampaigns),
  unsubscribes: many(emailUnsubscribes),
  questionList: many(eventQuestions),
}));

export const eventQuestionsRelations = relations(
  eventQuestions,
  ({ one, many }) => ({
    event: one(events, {
      fields: [eventQuestions.eventId],
      references: [events.id],
    }),
    voteList: many(eventQuestionVotes),
  }),
);

export const eventQuestionVotesRelations = relations(
  eventQuestionVotes,
  ({ one }) => ({
    question: one(eventQuestions, {
      fields: [eventQuestionVotes.questionId],
      references: [eventQuestions.id],
    }),
  }),
);

export const ticketsRelations = relations(tickets, ({ one }) => ({
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
  feedback: one(eventFeedback, {
    fields: [tickets.id],
    references: [eventFeedback.ticketId],
  }),
}));

export const waitlistRelations = relations(waitlist, ({ one }) => ({
  event: one(events, { fields: [waitlist.eventId], references: [events.id] }),
}));

export const suggestRelations = relations(suggest, ({ many }) => ({
  voteList: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  suggest: one(suggest, {
    fields: [votes.speakerId],
    references: [suggest.id],
  }),
}));

export const notifyRelations = relations(notify, ({ one }) => ({
  event: one(events, { fields: [notify.speakerId], references: [events.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  event: one(events, { fields: [referrals.eventId], references: [events.id] }),
}));

export const eventFeedbackRelations = relations(eventFeedback, ({ one }) => ({
  event: one(events, {
    fields: [eventFeedback.eventId],
    references: [events.id],
  }),
  ticket: one(tickets, {
    fields: [eventFeedback.ticketId],
    references: [tickets.id],
  }),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({ one }) => ({
  event: one(events, {
    fields: [emailCampaigns.eventId],
    references: [events.id],
  }),
}));

export const emailUnsubscribesRelations = relations(emailUnsubscribes, ({ one }) => ({
  event: one(events, {
    fields: [emailUnsubscribes.eventId],
    references: [events.id],
  }),
}));
