import { redirect } from "next/navigation";
import Link from "next/link";
import {
  createServerSupabaseClient,
  getSupabaseClient,
  formatEventDate,
  formatTime,
} from "@/app/lib/supabase";
import SignOutButton from "./SignOutButton";

interface RawTicket {
  id: string;
  event_id: string;
  created_at: string;
  type: string | null;
  events:
    | {
        id: string;
        name: string | null;
        route: string | null;
        doors_open: string | null;
        venue: string | null;
      }
    | {
        id: string;
        name: string | null;
        route: string | null;
        doors_open: string | null;
        venue: string | null;
      }[]
    | null;
}

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

async function getUserTickets(): Promise<Ticket[]> {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return [];
  }

  const adminClient = getSupabaseClient();

  // Get all tickets for this user with event information
  const { data: tickets, error } = await adminClient
    .from("tickets")
    .select(
      `
      id,
      event_id,
      created_at,
      type,
      events (
        id,
        name,
        route,
        doors_open,
        venue
      )
    `,
    )
    .eq("email", user.email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user tickets:", error);
    return [];
  }

  // Handle events relation - Supabase may return it as array or object
  return (tickets || []).map((ticket: RawTicket) => {
    let events = ticket.events;
    if (Array.isArray(events)) {
      events = events[0] || null;
    }
    return {
      ...ticket,
      events,
    };
  }) as Ticket[];
}

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to sign in if not authenticated
  if (!user?.email) {
    redirect(`/api/auth/google?redirect_to=${encodeURIComponent("/account")}`);
  }

  const tickets = await getUserTickets();

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-24">
        <section className="w-full max-w-5xl flex flex-col lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-2 font-serif">
              My Account
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Manage your tickets and account settings
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-6 font-serif">
              My Tickets
            </h2>
            {tickets.length === 0 ? (
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 md:p-8 text-center">
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  You don&#39;t have any tickets yet.
                </p>
                <Link
                  href="/upcoming-speakers"
                  className="inline-flex rounded px-6 py-3 text-base font-semibold text-white bg-[#A80D0C] transform transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110 hover:bg-[#C11211]"
                >
                  Browse Upcoming Events
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
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
                    <div
                      key={ticket.id}
                      className="bg-white dark:bg-zinc-800 rounded-lg p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-black dark:text-white mb-3 font-serif">
                            {event.name || "Event"}
                          </h3>
                          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {eventDate && (
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <span className="text-sm sm:text-base text-black dark:text-white font-medium">
                                  Date: {eventDate}
                                  {eventTime && ` at ${eventTime}`}
                                </span>
                              </div>
                            )}
                            {event.venue && (
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                <span className="text-sm sm:text-base text-black dark:text-white font-medium">
                                  {event.venue}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                                />
                              </svg>
                              <span className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                                Ticket ID: {ticket.id}
                              </span>
                            </div>
                          </div>
                        </div>
                        {event.route && (
                          <a
                            href={`/events/${event.route}`}
                            className="inline-flex items-center justify-center gap-2 rounded px-4 py-2 md:text-base text-sm font-semibold text-white bg-[#A80D0C] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110 hover:bg-[#C11211] w-full md:w-auto"
                          >
                            <span>View Event</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-700">
            <SignOutButton />
          </div>
        </section>
      </main>
    </div>
  );
}
