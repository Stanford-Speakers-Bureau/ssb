import {
  pgTable,
  uuid,
  text,
  boolean,
  bigint,
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
  },
  (t) => [
    index("tickets_email_idx").on(t.email),
    index("tickets_event_id_idx").on(t.eventId),
    index("tickets_event_type_idx").on(t.eventId, t.type),
    index("tickets_referral_idx").on(t.referral),
    index("tickets_scanned_idx").on(t.scanned),
    uniqueIndex("tickets_event_email_unique").on(t.eventId, t.email),
  ],
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
  },
  (t) => [
    index("suggest_email_idx").on(t.email),
    index("suggest_reviewed_idx").on(t.reviewed),
    index("suggest_speaker_idx").on(t.speaker),
    index("suggest_votes_idx").on(t.votes),
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
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  email: text("email"),
  roles: text("roles"),
});

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

// ── Relations ───────────────────────────────────────────────────────────────

export const eventsRelations = relations(events, ({ many }) => ({
  ticketList: many(tickets),
  waitlistList: many(waitlist),
  referralList: many(referrals),
  notifyList: many(notify),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
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
