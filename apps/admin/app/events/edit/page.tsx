import { getSignedImageUrl, serializeEvent } from "@/app/lib/supabase";
import {
  canUseActionForEvent,
  getEffectivePermissions,
  permittedEventIdsForAction,
} from "@/app/lib/permissions";
import { getSessionUser } from "@/app/lib/auth";
import { db } from "@ssb/db";
import { connection } from "next/server";
import { Event } from "../AdminEventsClient";
import EditEventClient from "./EditEventClient";

export const dynamic = "force-dynamic";

async function getAllEvents(): Promise<Event[]> {
  try {
    const user = await getSessionUser();
    const perms = await getEffectivePermissions(user?.email);
    const editableEventIds = permittedEventIdsForAction(perms, "events.edit");
    const canCreate = canUseActionForEvent(perms, "events.create", null);

    if (!canCreate && editableEventIds?.size === 0) {
      return [];
    }
    if (editableEventIds?.size === 0) return [];

    const eventList = await db.query.events.findMany({
      where: editableEventIds
        ? (table, { inArray }) => inArray(table.id, [...editableEventIds])
        : undefined,
      orderBy: (table, operators) => [operators.desc(table.startTimeDate)],
    });

    const eventsWithImages = await Promise.all(
      eventList.map(async (event) => {
        const serialized = serializeEvent(event);
        return {
          ...serialized,
          image_url: event.img
            ? await getSignedImageUrl(event.img, 60 * 60)
            : null,
          mobile_image_url: event.mobileImg
            ? await getSignedImageUrl(event.mobileImg, 60 * 60)
            : null,
          apple_wallet_image_url: event.appleWalletImg
            ? await getSignedImageUrl(event.appleWalletImg, 60 * 60)
            : null,
        };
      }),
    );

    return eventsWithImages as Event[];
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return [];
  }
}

export default async function EditEventPage() {
  await connection();
  const events = await getAllEvents();
  return <EditEventClient allEvents={events} />;
}
