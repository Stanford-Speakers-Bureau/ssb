import MailingListsClient from "./MailingListsClient";
import { getSessionUser } from "@/app/lib/auth";
import { hasPermission } from "@/app/lib/permissions";
import {
  announceStats,
  listAnnounceMembers,
  listAnnounceOptOuts,
  listNewsletterOptOuts,
  newsletterStats,
} from "@/app/lib/mailing-list";
import { db, desc, events } from "@ssb/db";

export const dynamic = "force-dynamic";

const INITIAL_LIMIT = 50;

async function getInitialData() {
  try {
    const user = await getSessionUser();
    if (!user?.email || !(await hasPermission(user.email, "audience.view"))) {
      return {
        rows: [],
        total: 0,
        optOuts: [],
        stats: { total: 0, optedOut: 0 },
        newsletterOptOuts: [],
        newsletterStats: { total: 0, optedOut: 0 },
        events: [],
      };
    }

    const [{ rows, total }, optOuts, stats, nlOptOuts, nlStats, allEvents] =
      await Promise.all([
        listAnnounceMembers({ search: null, limit: INITIAL_LIMIT, offset: 0 }),
        listAnnounceOptOuts(),
        announceStats(),
        listNewsletterOptOuts(),
        newsletterStats(),
        db.query.events.findMany({
          columns: { id: true, name: true, startTimeDate: true },
          orderBy: [desc(events.startTimeDate)],
        }),
      ]);

    return {
      rows,
      total,
      optOuts,
      stats,
      newsletterOptOuts: nlOptOuts,
      newsletterStats: nlStats,
      events: allEvents.map((e) => ({
        id: e.id,
        name: e.name ?? "Untitled event",
        startTime: e.startTimeDate?.toISOString() ?? null,
      })),
    };
  } catch (err) {
    console.error("[mailing-lists] initial load failed:", err);
    return {
      rows: [],
      total: 0,
      optOuts: [],
      stats: { total: 0, optedOut: 0 },
      newsletterOptOuts: [],
      newsletterStats: { total: 0, optedOut: 0 },
      events: [],
    };
  }
}

export default async function MailingListsPage() {
  const data = await getInitialData();
  return (
    <MailingListsClient
      initialRows={data.rows}
      initialTotal={data.total}
      initialOptOuts={data.optOuts}
      initialStats={data.stats}
      initialNewsletterOptOuts={data.newsletterOptOuts}
      initialNewsletterStats={data.newsletterStats}
      events={data.events}
      initialLimit={INITIAL_LIMIT}
    />
  );
}
