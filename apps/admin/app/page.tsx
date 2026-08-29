import Link from "next/link";
import {
  db,
  eq,
  count as dbCount,
  suggest,
  events,
  notify,
  waitlist,
  desc,
} from "@ssb/db";
import { connection } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import {
  getEffectivePermissions,
  permittedEventIds,
  type PermissionAction,
} from "@/app/lib/permissions";

export const dynamic = "force-dynamic";

type UpcomingEvent = {
  id: string;
  name: string | null;
  tagline: string | null;
  startTimeDate: Date | null;
  doorsOpen: Date | null;
  venue: string | null;
  venueLink: string | null;
  live: boolean;
  capacity: number;
  publicTicketsSold: number;
  vipTicketsSold: number;
  standbyTicketsSold: number;
  standbyEnabled: boolean;
  scanned: number;
  questionsEnabled: boolean;
  isPast: boolean;
};

type Caps = {
  ticketsOrAudience: boolean;
  scan: boolean;
  eventsEdit: boolean;
  ticketsView: boolean;
  questions: boolean;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function countdownLabel(start: Date): string {
  const days = Math.ceil((start.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Past event";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

type EventRow = Omit<UpcomingEvent, "isPast">;

// Pick the event to feature: the soonest upcoming event the user may see,
// falling back to the most recent past one. Kept out of the component body so
// the time read stays out of render.
function pickFeaturedEvent(
  rows: EventRow[],
  allowedIds: Set<string> | null,
): UpcomingEvent | null {
  const visible = allowedIds ? rows.filter((e) => allowedIds.has(e.id)) : rows;
  const dated = visible.filter((e) => e.startTimeDate);
  const now = Date.now();
  const next = [...dated]
    .sort((a, b) => a.startTimeDate!.getTime() - b.startTimeDate!.getTime())
    .find((e) => e.startTimeDate!.getTime() >= now);
  const chosen = next ?? dated[0] ?? null; // dated[0] = most recent (desc order)
  if (!chosen) return null;
  return {
    ...chosen,
    isPast: chosen.startTimeDate ? chosen.startTimeDate.getTime() < now : false,
  };
}

// ── Shared presentational fragments ──────────────────────────────────────────

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-400">
      <span className="size-1.5 rounded-full bg-rose-400" />
      Live
    </span>
  );
}

function EventFacts({
  e,
  sold,
  fillPct,
  caps,
}: {
  e: UpcomingEvent;
  sold: number;
  fillPct: number;
  caps: Caps;
}) {
  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">When</p>
        <p className="mt-1 text-white">
          {e.startTimeDate
            ? `${dateFmt.format(e.startTimeDate)}, ${timeFmt.format(e.startTimeDate)}`
            : "Not scheduled"}
        </p>
        {e.doorsOpen && (
          <p className="text-sm text-zinc-500">
            Doors {timeFmt.format(e.doorsOpen)}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Where</p>
        <p className="mt-1 text-white">
          {e.venueLink && e.venue ? (
            <a
              href={e.venueLink}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              {e.venue}
            </a>
          ) : (
            (e.venue ?? "TBD")
          )}
        </p>
      </div>

      {caps.ticketsOrAudience && (
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Tickets
          </p>
          <p className="mt-1 text-white tabular-nums">
            {sold.toLocaleString()} / {e.capacity.toLocaleString()}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 w-(--fill)"
              style={{ "--fill": `${fillPct}%` } as React.CSSProperties}
            />
          </div>
          {e.standbyEnabled && (
            <p className="mt-1 text-sm text-zinc-500 tabular-nums">
              {e.standbyTicketsSold.toLocaleString()} standby
            </p>
          )}
        </div>
      )}

      {caps.scan && (
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Checked in
          </p>
          <p className="mt-1 text-white tabular-nums">
            {e.scanned.toLocaleString()} / {sold.toLocaleString()}
          </p>
        </div>
      )}
    </>
  );
}

function EventActions({ e, caps }: { e: UpcomingEvent; caps: Caps }) {
  return (
    <>
      {caps.eventsEdit && (
        <Link
          href={`/events/edit/${e.id}`}
          prefetch={false}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          Manage event
        </Link>
      )}
      {caps.ticketsView && (
        <Link
          href="/tickets"
          prefetch={false}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          Tickets
        </Link>
      )}
      {caps.scan && (
        <Link
          href="/check-in"
          prefetch={false}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          Check-in
        </Link>
      )}
      {e.questionsEnabled && caps.questions && (
        <Link
          href="/event-questions"
          prefetch={false}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          Moderate Q&amp;A
        </Link>
      )}
    </>
  );
}

function QuickActionIcon({ d }: { d: string }) {
  return (
    <svg
      className="size-5 text-zinc-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={d}
      />
    </svg>
  );
}

export default async function AdminDashboard() {
  await connection();
  const user = await getSessionUser();
  const perms = await getEffectivePermissions(user?.email);
  const can = (action: PermissionAction) =>
    perms.isAdmin || perms.actions.has(action);

  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? null;

  // ── Find the event to feature: the soonest upcoming event the user can see,
  //    falling back to the most recent past one. ────────────────────────────
  let upcoming: UpcomingEvent | null = null;
  try {
    const eventRows = await db.query.events.findMany({
      columns: {
        id: true,
        name: true,
        tagline: true,
        startTimeDate: true,
        doorsOpen: true,
        venue: true,
        venueLink: true,
        live: true,
        capacity: true,
        publicTicketsSold: true,
        vipTicketsSold: true,
        standbyTicketsSold: true,
        standbyEnabled: true,
        scanned: true,
        questionsEnabled: true,
      },
      orderBy: desc(events.startTimeDate),
    });

    upcoming = pickFeaturedEvent(eventRows, permittedEventIds(perms));
  } catch (error) {
    console.error("Failed to load featured event for dashboard:", error);
  }

  // ── Action items + at-a-glance numbers, each gated by permission. ─────────
  const showSuggestions = can("suggestions.manage");
  const showAudience = can("audience.view");
  const showWaitlist = can("tickets.edit") && !!upcoming && !upcoming.isPast;

  const [pendingSuggestions, totalSubscribers, totalEvents, waitlistCount] =
    await Promise.all([
      showSuggestions
        ? db
            .select({ count: dbCount() })
            .from(suggest)
            .where(eq(suggest.reviewed, false))
            .then(([r]) => r?.count ?? 0)
            .catch(() => 0)
        : Promise.resolve(0),
      showAudience
        ? db
            .select({ count: dbCount() })
            .from(notify)
            .then(([r]) => r?.count ?? 0)
            .catch(() => 0)
        : Promise.resolve(0),
      db
        .select({ count: dbCount() })
        .from(events)
        .then(([r]) => r?.count ?? 0)
        .catch(() => 0),
      showWaitlist
        ? db
            .select({ count: dbCount() })
            .from(waitlist)
            .where(eq(waitlist.eventId, upcoming!.id))
            .then(([r]) => r?.count ?? 0)
            .catch(() => 0)
        : Promise.resolve(0),
    ]);

  const sold = upcoming
    ? upcoming.publicTicketsSold + upcoming.vipTicketsSold
    : 0;
  const fillPct =
    upcoming && upcoming.capacity > 0
      ? Math.min(100, Math.round((sold / upcoming.capacity) * 100))
      : 0;

  const caps: Caps = {
    ticketsOrAudience: can("audience.view") || can("tickets.view"),
    scan: can("tickets.scan"),
    eventsEdit: can("events.edit"),
    ticketsView: can("tickets.view"),
    questions: can("questions.manage"),
  };

  const attentionItems = [
    {
      show: showSuggestions,
      label: "Pending suggestions",
      value: pendingSuggestions,
      hint: "Awaiting review",
      href: "/suggest",
    },
    {
      show: showWaitlist,
      label: "Waitlist",
      value: waitlistCount,
      hint: upcoming?.name ?? "Upcoming event",
      href: "/waitlist",
    },
  ].filter((i) => i.show);

  const glanceStats = [
    { show: true, label: "Total events", value: totalEvents, href: "/events" },
    {
      show: showAudience,
      label: "Subscribers",
      value: totalSubscribers,
      href: "/notify-analytics",
    },
  ].filter((s) => s.show);

  const quickActions = [
    {
      show: can("suggestions.manage"),
      href: "/suggest",
      title: "Review suggestions",
      desc: "Approve or reject speakers",
      icon: "M5 13l4 4L19 7",
    },
    {
      show: can("events.create"),
      href: "/events",
      title: "Create event",
      desc: "Add a new speaker event",
      icon: "M12 6v6m0 0v6m0-6h6m-6 0H6",
    },
    {
      show: can("campaigns.send"),
      href: "/campaigns",
      title: "New campaign",
      desc: "Send an email campaign",
      icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    },
    {
      show: can("audience.view"),
      href: "/notify-analytics",
      title: "View signups",
      desc: "Event notification lists",
      icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    },
  ].filter((a) => a.show);

  const greeting = firstName ? `Welcome back, ${firstName}` : "Dashboard";
  const heroLabel = upcoming?.isPast ? "Most recent event" : "Upcoming event";

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-serif text-2xl font-semibold text-white sm:text-3xl">
          {greeting}
        </h1>
        <p className="text-zinc-400">
          Here&rsquo;s what&rsquo;s happening with the Speakers Bureau.
        </p>
      </div>

      <div className="@container">
        <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
          {upcoming && (
            <div className="col-span-2 rounded-2xl border border-white/10 bg-zinc-900/60 p-6 @3xl:col-span-2 @3xl:row-span-2">
              <p className="mb-3 text-sm font-medium tracking-wide text-zinc-500">
                {heroLabel}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-serif text-xl font-bold text-white">
                  {upcoming.name ?? "Untitled event"}
                </h3>
                {upcoming.live && <LiveBadge />}
                {upcoming.startTimeDate && (
                  <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-medium text-zinc-300">
                    {countdownLabel(upcoming.startTimeDate)}
                  </span>
                )}
              </div>
              {upcoming.tagline && (
                <p className="mt-1 text-zinc-400">{upcoming.tagline}</p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <EventFacts
                  e={upcoming}
                  sold={sold}
                  fillPct={fillPct}
                  caps={caps}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <EventActions e={upcoming} caps={caps} />
              </div>
            </div>
          )}

          {attentionItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              prefetch={false}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-amber-500/5 p-5 transition-colors hover:border-amber-500/40"
            >
              <p className="truncate text-sm text-zinc-400">{item.label}</p>
              <div>
                <p className="text-3xl font-bold text-amber-400 tabular-nums">
                  {item.value.toLocaleString()}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {item.hint}
                </p>
              </div>
            </Link>
          ))}

          {glanceStats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              prefetch={false}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-900/60 p-5 transition-colors hover:border-white/20"
            >
              <p className="truncate text-sm text-zinc-400">{stat.label}</p>
              <p className="text-3xl font-bold text-white tabular-nums">
                {stat.value.toLocaleString()}
              </p>
            </Link>
          ))}

          {quickActions.length > 0 && (
            <div className="col-span-2 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 @3xl:col-span-2">
              <p className="mb-3 truncate text-sm text-zinc-400">
                Quick actions
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    prefetch={false}
                    className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-zinc-800"
                  >
                    <QuickActionIcon d={action.icon} />
                    <span className="font-medium text-white">
                      {action.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
