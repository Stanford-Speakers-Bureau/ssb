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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Events ──────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  name: text("name"),
  capacity: bigint("capacity", { mode: "number" }).notNull().default(0),
  venue: text("venue"),
  reserved: bigint("reserved", { mode: "number" }).notNull().default(0),
  venueLink: text("venue_link"),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  banner: boolean("banner"),
  startTimeDate: timestamp("start_time_date", { withTimezone: true }),
  doorsOpen: timestamp("doors_open", { withTimezone: true }),
  desc: text("desc"),
  img: text("img"),
  route: text("route"),
  tagline: text("tagline"),
  tickets: bigint("tickets", { mode: "number" }).notNull().default(0),
  live: boolean("live").notNull().default(false),
  scanned: bigint("scanned", { mode: "number" }).notNull().default(0),
  latitude: numeric("latitude").notNull().default("0"),
  longitude: numeric("longitude").notNull().default("0"),
  address: text("address").notNull().default(""),
  imgVersion: bigint("img_version", { mode: "number" }).notNull().default(1),
  ticketingDate: timestamp("ticketing_date", { withTimezone: true }),
  livestream: boolean("livestream").default(false),
  title: text("title"),
  waitlistChance: text("waitlist_chance").notNull().default("High"),
});

// ── Tickets ─────────────────────────────────────────────────────────────────
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    email: text("email").notNull(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
    index("tickets_referral_idx").on(t.referral),
    index("tickets_scanned_idx").on(t.scanned),
  ],
);

// ── Waitlist ────────────────────────────────────────────────────────────────
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    referral: text("referral"),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    speakerId: uuid("speaker_id").references(() => suggest.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    email: text("email").notNull(),
    speakerId: uuid("speaker_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [index("notify_speaker_id_idx").on(t.speakerId)],
);

// ── Referrals ───────────────────────────────────────────────────────────────
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    eventId: uuid("event_id")
      .notNull()
      .defaultRandom()
      .references(() => events.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  email: text("email"),
  roles: text("roles"),
});

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
  suggest: one(suggest, { fields: [votes.speakerId], references: [suggest.id] }),
}));

export const notifyRelations = relations(notify, ({ one }) => ({
  event: one(events, { fields: [notify.speakerId], references: [events.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  event: one(events, { fields: [referrals.eventId], references: [events.id] }),
}));