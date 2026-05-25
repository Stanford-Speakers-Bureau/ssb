import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatEventDate, formatTime } from "@/app/lib/supabase";
import { getSessionUser, getUserProfileByEmail } from "@/app/lib/auth";
import { db, eq, tickets } from "@ssb/db";
import SignOutButton from "./SignOutButton";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

interface Ticket {
  id: string;
  event_id: string;
  created_at: string;
  type: string | null;
  events: {
    id: string;
    name: string | null;
    route: string | null;
    doors_open: string | null;
    venue: string | null;
  } | null;
}

function formatAffiliationLabel(affiliation: string): string {
  return affiliation
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getUserTickets(): Promise<Ticket[]> {
  const user = await getSessionUser();

  if (!user?.email) {
    return [];
  }

  const userTickets = await db.query.tickets.findMany({
    where: eq(tickets.email, user.email),
    with: {
      event: {
        columns: { id: true, name: true, route: true, doorsOpen: true, venue: true },
      },
    },
    orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
  });

  return userTickets.map((t) => ({
    id: t.id,
    event_id: t.eventId || "",
    created_at: t.createdAt.toISOString(),
    type: t.type,
    events: t.event
      ? {
        id: t.event.id,
        name: t.event.name,
        route: t.event.route,
        doors_open: t.event.doorsOpen?.toISOString() ?? null,
        venue: t.event.venue,
      }
      : null,
  }));
}

export default async function AccountPage() {
  const user = await getSessionUser();

  // Redirect to sign in if not authenticated
  if (!user?.email) {
    redirect(`/api/auth/login?redirect_to=${encodeURIComponent("/account")}`);
  }

  const userProfile = await getUserProfileByEmail(user.email);
  const affiliations = userProfile?.eduPersonAffiliation?.length
    ? userProfile.eduPersonAffiliation
    : user.eduPersonAffiliation;
  const tickets = await getUserTickets();

  const fullName = user.displayName?.trim() ?? "";
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? null;
  const initials = (
    nameParts.map((part) => part[0]).slice(0, 2).join("") ||
    user.email[0] ||
    "?"
  ).toUpperCase();

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 isolate font-sans">
      {/* Identity header */}
      <section className="px-6 sm:px-16 pt-28 sm:pt-36 pb-12 sm:pb-16 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-[0.65rem] tracking-[0.5em] uppercase text-ssb-accent mb-6">
            My Account
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-7">
            <div className="flex items-center gap-5">
              <div className="flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-full border border-ssb-accent/30 bg-ssb-accent/10">
                <span className="font-serif text-2xl sm:text-3xl text-ssb-accent">
                  {initials}
                </span>
              </div>
              <div className="min-w-0">
                <h1 className="font-serif text-3xl sm:text-5xl text-white tracking-tight text-balance">
                  {firstName ? `Hi, ${firstName}.` : "Welcome back."}
                </h1>
                <p className="text-sm text-zinc-400 mt-1.5 break-all">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <SignOutButton />
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-3">
            <p className="font-mono text-[0.55rem] tracking-[0.3em] uppercase text-zinc-500 shrink-0">
              Stanford affiliation
            </p>
            {affiliations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {affiliations.map((affiliation) => (
                  <span
                    key={affiliation}
                    className="rounded-full border border-ssb-accent/30 bg-ssb-accent/5 px-3 py-1 text-xs font-semibold text-ssb-accent"
                  >
                    {formatAffiliationLabel(affiliation)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Stanford SSO didn&rsquo;t provide an affiliation for your account.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Tickets */}
      <section className="px-6 sm:px-16 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <h2 className="font-serif text-2xl sm:text-3xl text-white tracking-tight">
              My tickets
            </h2>
            {tickets.length > 0 && (
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
              </span>
            )}
          </div>

          {tickets.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-900/40 px-6 py-16 text-center">
              <p className="font-serif text-2xl text-white mb-2">
                No tickets yet.
              </p>
              <p className="text-sm text-zinc-400 mb-7 max-w-sm mx-auto text-pretty leading-relaxed">
                When you reserve a spot at an upcoming event, your tickets will
                show up here.
              </p>
              <Link
                href="/upcoming-speakers"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ssb-accent px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-ssb-accent/25 hover:bg-ssb-accent-strong transition-colors focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Browse upcoming events
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </Link>
            </div>
          ) : (
            <ul role="list" className="space-y-4">
              {tickets.map((ticket) => {
                const event = ticket.events;
                if (!event) return null;

                const eventDate = event.doors_open
                  ? formatEventDate(event.doors_open)
                  : null;
                const eventTime = event.doors_open
                  ? formatTime(event.doors_open)
                  : null;

                return (
                  <li
                    key={ticket.id}
                    className="group border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 p-6 sm:p-7">
                      <div className="flex-1 min-w-0">
                        {ticket.type && (
                          <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 font-mono text-[0.55rem] tracking-[0.25em] uppercase text-zinc-400 mb-3">
                            {ticket.type}
                          </span>
                        )}
                        <h3 className="font-serif text-xl sm:text-2xl text-white tracking-tight text-balance">
                          {event.name || "Event"}
                        </h3>
                        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
                          <div className="min-w-0">
                            <dt className="font-mono text-[0.55rem] tracking-[0.25em] uppercase text-zinc-500 mb-1.5">
                              Date
                            </dt>
                            <dd className="text-sm text-zinc-200 font-medium">
                              {eventDate ? (
                                <>
                                  {eventDate}
                                  {eventTime && (
                                    <span className="text-zinc-400 tabular-nums">
                                      {" · "}
                                      {eventTime}
                                    </span>
                                  )}
                                </>
                              ) : (
                                "To be announced"
                              )}
                            </dd>
                          </div>
                          {event.venue && (
                            <div className="min-w-0">
                              <dt className="font-mono text-[0.55rem] tracking-[0.25em] uppercase text-zinc-500 mb-1.5">
                                Venue
                              </dt>
                              <dd
                                className="text-sm text-zinc-200 font-medium truncate"
                                title={event.venue}
                              >
                                {event.venue}
                              </dd>
                            </div>
                          )}
                          <div className="min-w-0">
                            <dt className="font-mono text-[0.55rem] tracking-[0.25em] uppercase text-zinc-500 mb-1.5">
                              Ticket ID
                            </dt>
                            <dd
                              className="text-sm font-mono text-zinc-400 truncate"
                              title={ticket.id}
                            >
                              {ticket.id}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      {event.route && (
                        <a
                          href={`/events/${event.route}`}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:border-ssb-accent/50 hover:text-white transition-colors w-full md:w-auto shrink-0"
                        >
                          View event
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
