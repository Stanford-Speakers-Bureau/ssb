import { randomUUID } from "node:crypto";
import postgres from "postgres";

import { assertLocalDatabaseUrl } from "./env";

type Cleanup = () => Promise<unknown>;
type EventOverrides = Partial<{
  id: string;
  name: string;
  route: string;
  capacity: number;
  reserved: number;
  live: boolean;
  releaseDate: Date;
  startTimeDate: Date;
  endTimeDate: Date;
  ticketingDate: Date;
  standbyEnabled: boolean;
  questionsEnabled: boolean;
  referralsEnabled: boolean;
  allowAdmittingStandby: boolean;
}>;

const runId =
  process.env.TEST_RUN_ID || `${Date.now().toString(36)}-${process.pid}`;
let sequence = 0;
const cleanups: Cleanup[] = [];
let database: ReturnType<typeof postgres> | null = null;

export function uniqueTestValue(prefix: string): string {
  sequence += 1;
  return `${prefix}-${runId}-${sequence}`.toLowerCase();
}

export function testEmail(prefix = "user"): string {
  return `${uniqueTestValue(prefix)}@it.test`;
}

export function getTestDatabase() {
  assertLocalDatabaseUrl();
  database ??= postgres(process.env.DATABASE_URL!, {
    max: 2,
    prepare: false,
    onnotice: () => undefined,
  });
  return database;
}

export function registerCleanup(cleanup: Cleanup): void {
  cleanups.push(cleanup);
}

export async function cleanup(): Promise<void> {
  const pending = cleanups.splice(0).reverse();
  const failures: unknown[] = [];
  for (const remove of pending) {
    try {
      await remove();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Test cleanup failed");
}

export async function closeTestDatabase(): Promise<void> {
  if (database) await database.end({ timeout: 1 });
  database = null;
}

export async function makeEvent(overrides: EventOverrides = {}) {
  const sql = getTestDatabase();
  const id = overrides.id ?? randomUUID();
  const route = overrides.route ?? uniqueTestValue("ev");
  const start =
    overrides.startTimeDate ?? new Date("2030-01-01T19:00:00-08:00");
  const [event] = await sql`
    insert into events (
      id, name, route, capacity, reserved, live, release_date,
      start_time_date, end_time_date, ticketing_date, standby_enabled,
      questions_enabled, referrals_enabled, allow_admitting_standby, venue, address
    ) values (
      ${id}, ${overrides.name ?? `Test Event ${route}`}, ${route},
      ${overrides.capacity ?? 10}, ${overrides.reserved ?? 0},
      ${overrides.live ?? true}, ${overrides.releaseDate ?? new Date("2020-01-01T00:00:00Z")},
      ${start}, ${overrides.endTimeDate ?? new Date(start.getTime() + 7_200_000)},
      ${overrides.ticketingDate ?? new Date("2020-01-01T00:00:00Z")},
      ${overrides.standbyEnabled ?? false}, ${overrides.questionsEnabled ?? true},
      ${overrides.referralsEnabled ?? true},
      ${overrides.allowAdmittingStandby ?? false}, ${"Test Auditorium"}, ${"1 Test Way"}
    ) returning *
  `;
  registerCleanup(() => sql`delete from events where id = ${id}`);
  return event;
}

export async function makeTicket(input: {
  eventId: string;
  email?: string;
  name?: string;
  type?: string;
  scanned?: boolean;
}) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [ticket] = await sql`
    insert into tickets (id, event_id, email, name, type, scanned)
    values (${id}, ${input.eventId}, ${input.email ?? testEmail("ticket")},
      ${input.name ?? "Test Attendee"}, ${input.type ?? "STANDARD"},
      ${input.scanned ?? false}) returning *
  `;
  registerCleanup(() => sql`delete from tickets where id = ${id}`);
  return ticket;
}

export async function makeWaitlistEntry(input: {
  eventId: string;
  email?: string;
  name?: string;
  position?: number;
}) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [entry] = await sql`
    insert into waitlist (id, event_id, email, name, position)
    values (${id}, ${input.eventId}, ${input.email ?? testEmail("waitlist")},
      ${input.name ?? "Waitlisted User"}, ${input.position ?? 1}) returning *
  `;
  registerCleanup(() => sql`delete from waitlist where id = ${id}`);
  return entry;
}

export async function makeUserProfile(email = testEmail("profile")) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [profile] = await sql`
    insert into user_profiles (id, email, uid, display_name, edu_person_affiliation,
      edu_person_scoped_affiliation)
    values (${id}, ${email}, ${email}, ${"Test User"}, ${["staff"]},
      ${["staff@stanford.edu"]}) returning *
  `;
  registerCleanup(() => sql`delete from user_profiles where id = ${id}`);
  return profile;
}

export async function grantRole(email: string, role: string) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [row] = await sql`
    insert into roles (id, email, roles) values (${id}, ${email}, ${role}) returning *
  `;
  registerCleanup(() => sql`delete from roles where id = ${id}`);
  return row;
}

export async function grantPermission(input: {
  email: string;
  action: string;
  eventId?: string | null;
  grantedBy?: string;
}) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [grant] = await sql`
    insert into permission_grants (id, email, action, event_id, granted_by)
    values (${id}, ${input.email}, ${input.action}, ${input.eventId ?? null},
      ${input.grantedBy ?? "test-suite@it.test"}) returning *
  `;
  registerCleanup(() => sql`delete from permission_grants where id = ${id}`);
  return grant;
}

export async function makeSuggestion(email = testEmail("suggestion")) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [suggestion] = await sql`
    insert into suggest (id, email, speaker, approved, reviewed)
    values (${id}, ${email}, ${`Speaker ${uniqueTestValue("name")}`}, true, true)
    returning *
  `;
  registerCleanup(() => sql`delete from suggest where id = ${id}`);
  return suggestion;
}

export async function makeCampaign(
  input: {
    subject?: string;
    body?: string;
    status?: string;
    eventId?: string | null;
  } = {},
) {
  const sql = getTestDatabase();
  const id = randomUUID();
  const [campaign] = await sql`
    insert into email_campaigns (
      id, subject, body, status, audiences, event_id, created_by
    )
    values (${id}, ${input.subject ?? "Integration campaign"},
      ${input.body ?? "<p>Test message</p>"}, ${input.status ?? "draft"},
      ${"[]"}, ${input.eventId ?? null}, ${"test-suite@it.test"}) returning *
  `;
  registerCleanup(() => sql`delete from email_campaigns where id = ${id}`);
  return campaign;
}
