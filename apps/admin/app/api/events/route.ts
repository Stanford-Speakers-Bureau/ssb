import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { fromZonedTime } from "date-fns-tz";
import {
  getSignedImageUrl,
  getSupabaseClient,
  serializeEvent,
} from "@/app/lib/supabase";
import { requirePermission } from "@/app/lib/permissions";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import { pullFromWaitlist } from "@/app/lib/waitlist";
import { db, and, eq, ne, events, tickets as ticketsTable } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import { pushWalletUpdate } from "@/app/lib/wallet-push";
import type { InferInsertModel, InferSelectModel } from "@ssb/db";
import {
  isTicketingRole,
  resolveTicketingRoles,
} from "@/app/lib/ticketingRoles";
import {
  isValidUUID,
  isValidUrl,
  isValidRoute,
  isValidCapacity,
  isValidImageExtension,
  isValidAppleWalletImageExtension,
  isValidImageSize,
  isValidDateString,
  isValidLatitude,
  isValidLongitude,
  isValidAddress,
} from "@/app/lib/validation";

async function uploadEventImage(
  adminClient: ReturnType<typeof getSupabaseClient>,
  imageFile: File | null,
  options?: {
    allowedType?: "default" | "apple-wallet";
  },
): Promise<string | null> {
  if (!imageFile || imageFile.size === 0) {
    return null;
  }

  if (!isValidImageSize(imageFile.size)) {
    throw new Error("Image file too large. Maximum size is 5MB.");
  }

  const isAppleWalletImage = options?.allowedType === "apple-wallet";

  if (
    isAppleWalletImage
      ? !isValidAppleWalletImageExtension(imageFile.name)
      : !isValidImageExtension(imageFile.name)
  ) {
    throw new Error(
      isAppleWalletImage
        ? "Invalid Apple Wallet image file type. Upload a PNG."
        : "Invalid image file type. Allowed types: JPG, PNG, GIF, WebP.",
    );
  }

  if (isAppleWalletImage && imageFile.type && imageFile.type !== "image/png") {
    throw new Error("Invalid Apple Wallet image file type. Upload a PNG.");
  }

  const fileExt = imageFile.name.split(".").pop();
  const fileName = `${Date.now()}-${randomUUID()}.${fileExt}`;

  const { error: uploadError } = await adminClient.storage
    .from("speakers")
    .upload(fileName, imageFile, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Image upload error:", uploadError);
    throw new Error("Failed to upload image");
  }

  return fileName;
}

type EventSnapshot = Record<string, unknown>;

function buildEventSnapshot(
  event: InferSelectModel<typeof events>,
): EventSnapshot {
  return {
    name: event.name,
    description: event.desc,
    tagline: event.tagline,
    venue: event.venue,
    venueLink: event.venueLink,
    address: event.address || null,
    latitude: event.latitude,
    longitude: event.longitude,
    route: event.route,
    priorityNotice: event.priority,
    capacity: event.capacity,
    tickets: event.tickets,
    reserved: event.reserved,
    releaseDate: event.releaseDate ? event.releaseDate.toISOString() : null,
    ticketingDate: event.ticketingDate
      ? event.ticketingDate.toISOString()
      : null,
    startTime: event.startTimeDate ? event.startTimeDate.toISOString() : null,
    endTime: event.endTimeDate ? event.endTimeDate.toISOString() : null,
    doorsOpen: event.doorsOpen ? event.doorsOpen.toISOString() : null,
    hideTicketingDate: event.hideTicketingDate,
    referralsEnabled: event.referralsEnabled,
    standbyEnabled: event.standbyEnabled,
    bannerEligible: event.bannerEligible,
    externalTicketingEnabled: event.externalTicketingEnabled,
    externalTicketingUrl: event.externalTicketingUrl,
    livestream: event.livestream,
    ticketingRoles: [...event.ticketingRoles],
    image: event.img,
    mobileImage: event.mobileImg,
    appleWalletImage: event.appleWalletImg,
  };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }
  return a === b;
}

function diffEventSnapshots(
  before: EventSnapshot,
  after: EventSnapshot,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (!valuesEqual(before[key], after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}

async function serializeEventWithImages(
  event: InferSelectModel<typeof events>,
) {
  const serialized = serializeEvent(event);
  return {
    ...serialized,
    image_url: event.img ? await getSignedImageUrl(event.img, 60 * 60) : null,
    mobile_image_url: event.mobileImg
      ? await getSignedImageUrl(event.mobileImg, 60 * 60)
      : null,
    apple_wallet_image_url: event.appleWalletImg
      ? await getSignedImageUrl(event.appleWalletImg, 60 * 60)
      : null,
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get("id") as string | null;
    const name = formData.get("name") as string;
    const desc = formData.get("desc") as string;
    const tagline = formData.get("tagline") as string;
    const capacity = formData.get("capacity") as string;
    const tickets = formData.get("tickets") as string;
    const reserved = formData.get("reserved") as string;
    const venue = formData.get("venue") as string;
    const venue_link = formData.get("venue_link") as string;
    const release_date = formData.get("release_date") as string;
    const ticketing_date = formData.get("ticketing_date") as string;
    const start_time_date = formData.get("start_time_date") as string;
    const end_time_date = formData.get("end_time_date") as string;
    const doors_open = formData.get("doors_open") as string;
    const route = formData.get("route") as string;
    const priority = formData.get("priority") as string;
    const hide_ticketing_date = formData.get("hide_ticketing_date") === "true";
    const referrals_enabled = formData.get("referrals_enabled") === "true";
    const standby_enabled = formData.get("standby_enabled") === "true";
    // identity verification defaults to true: only an explicit "false" disables
    // it, so older form payloads keep the verify-by-default behavior.
    const identity_verification_enabled =
      formData.get("identity_verification_enabled") !== "false";
    const allow_admitting_standby =
      formData.get("allow_admitting_standby") === "true";
    const livestream = formData.get("livestream") as string;
    const latitude = formData.get("latitude") as string;
    const longitude = formData.get("longitude") as string;
    const address = formData.get("address") as string;
    const external_ticketing_enabled =
      formData.get("external_ticketing_enabled") === "true";
    const external_ticketing_url =
      (formData.get("external_ticketing_url") as string | null)?.trim() || "";
    // banner_eligible defaults to true: only an explicit "false" disables it,
    // so older form payloads (or clients that don't send the field) keep the
    // current promote-everywhere behavior.
    const banner_eligible = formData.get("banner_eligible") !== "false";
    const rawTicketingRoles = formData
      .getAll("ticketing_roles")
      .filter((value): value is string => typeof value === "string");
    const imageFile = formData.get("image") as File | null;
    const mobileImageFile = formData.get("mobile_image") as File | null;
    const appleWalletImageFile = formData.get(
      "apple_wallet_image",
    ) as File | null;
    const invalidTicketingRole = rawTicketingRoles.find(
      (value) => !isTicketingRole(value),
    );

    // Validate ID if provided
    if (id && !isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    // Editing an existing event needs events.edit on that event; creating a
    // new one needs the global events.create.
    const auth = id
      ? await requirePermission("events.edit", id)
      : await requirePermission("events.create");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const adminClient = auth.adminClient!;

    // Validate capacity
    if (capacity && !isValidCapacity(capacity)) {
      return NextResponse.json(
        { error: "Invalid capacity value" },
        { status: 400 },
      );
    }

    // Validate priority notice length
    if (priority && priority.trim().length > 300) {
      return NextResponse.json(
        { error: "Priority notice must be 300 characters or less" },
        { status: 400 },
      );
    }

    // Validate livestream URL
    if (livestream && !isValidUrl(livestream)) {
      return NextResponse.json(
        { error: "Invalid livestream URL" },
        { status: 400 },
      );
    }

    // Validate venue_link URL
    if (venue_link && !isValidUrl(venue_link)) {
      return NextResponse.json(
        { error: "Invalid venue link URL" },
        { status: 400 },
      );
    }

    if (external_ticketing_enabled && !external_ticketing_url) {
      return NextResponse.json(
        {
          error:
            "External ticketing URL is required when external ticketing is enabled.",
        },
        { status: 400 },
      );
    }

    if (external_ticketing_url && !isValidUrl(external_ticketing_url)) {
      return NextResponse.json(
        { error: "Invalid external ticketing URL" },
        { status: 400 },
      );
    }

    // Validate route slug
    if (route && !isValidRoute(route)) {
      return NextResponse.json(
        {
          error:
            "Invalid route format. Use only lowercase letters, numbers, hyphens, and underscores.",
        },
        { status: 400 },
      );
    }

    // Validate dates
    if (release_date && !isValidDateString(release_date)) {
      return NextResponse.json(
        { error: "Invalid release date format" },
        { status: 400 },
      );
    }
    if (ticketing_date && !isValidDateString(ticketing_date)) {
      return NextResponse.json(
        { error: "Invalid ticketing date format" },
        { status: 400 },
      );
    }
    if (start_time_date && !isValidDateString(start_time_date)) {
      return NextResponse.json(
        { error: "Invalid start time date format" },
        { status: 400 },
      );
    }
    if (end_time_date && !isValidDateString(end_time_date)) {
      return NextResponse.json(
        { error: "Invalid end time date format" },
        { status: 400 },
      );
    }
    if (doors_open && !isValidDateString(doors_open)) {
      return NextResponse.json(
        { error: "Invalid doors open date format" },
        { status: 400 },
      );
    }

    // Validate latitude/longitude (required only when using in-platform ticketing,
    // since the map view is shown to ticket holders). External ticketing skips the map.
    if (!external_ticketing_enabled) {
      if (!latitude || !isValidLatitude(latitude)) {
        return NextResponse.json(
          { error: "Valid latitude is required (-90 to 90)" },
          { status: 400 },
        );
      }

      if (!longitude || !isValidLongitude(longitude)) {
        return NextResponse.json(
          { error: "Valid longitude is required (-180 to 180)" },
          { status: 400 },
        );
      }
    } else {
      if (latitude && !isValidLatitude(latitude)) {
        return NextResponse.json(
          { error: "Invalid latitude (-90 to 90)" },
          { status: 400 },
        );
      }
      if (longitude && !isValidLongitude(longitude)) {
        return NextResponse.json(
          { error: "Invalid longitude (-180 to 180)" },
          { status: 400 },
        );
      }
    }

    // Validate address
    if (address && !isValidAddress(address)) {
      return NextResponse.json(
        { error: "Address must be 500 characters or less" },
        { status: 400 },
      );
    }

    if (invalidTicketingRole) {
      return NextResponse.json(
        { error: "Invalid ticketing role selection" },
        { status: 400 },
      );
    }

    let existingEvent: InferSelectModel<typeof events> | null = null;

    if (id) {
      existingEvent =
        (await db.query.events.findFirst({
          where: eq(events.id, id),
        })) ?? null;
    }

    let imgName: string | null = null;
    let mobileImgName: string | null = null;
    let appleWalletImgName: string | null = null;

    try {
      imgName = await uploadEventImage(adminClient, imageFile);
      mobileImgName = await uploadEventImage(adminClient, mobileImageFile);
      appleWalletImgName = await uploadEventImage(
        adminClient,
        appleWalletImageFile,
        {
          allowedType: "apple-wallet",
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload image";
      return NextResponse.json(
        { error: message },
        {
          status:
            message.startsWith("Invalid") ||
            message.startsWith("Image file too large")
              ? 400
              : 500,
        },
      );
    }

    const parsedCapacity = capacity ? parseInt(capacity, 10) : 0;
    const parsedReserved = reserved ? parseInt(reserved, 10) : 0;
    const parsedTickets = tickets ? parseInt(tickets, 10) : parsedReserved;
    const releaseDateValue = release_date
      ? fromZonedTime(release_date, PACIFIC_TIMEZONE)
      : null;
    const ticketingDateValue = ticketing_date
      ? fromZonedTime(ticketing_date, PACIFIC_TIMEZONE)
      : null;
    const startTimeDateValue = start_time_date
      ? fromZonedTime(start_time_date, PACIFIC_TIMEZONE)
      : null;
    const endTimeDateValue = end_time_date
      ? fromZonedTime(end_time_date, PACIFIC_TIMEZONE)
      : null;
    const doorsOpenValue = doors_open
      ? fromZonedTime(doors_open, PACIFIC_TIMEZONE)
      : null;
    const ticketingRoles = resolveTicketingRoles(rawTicketingRoles);

    // Build event data object
    const eventData: InferInsertModel<typeof events> = {
      name: name || null,
      desc: desc || null,
      tagline: tagline || null,
      capacity: parsedCapacity,
      tickets: parsedTickets,
      reserved: parsedReserved,
      venue: venue || null,
      venueLink: venue_link || null,
      releaseDate: releaseDateValue,
      ticketingDate: ticketingDateValue,
      startTimeDate: startTimeDateValue,
      endTimeDate: endTimeDateValue,
      doorsOpen: doorsOpenValue,
      route: route || null,
      priority: priority?.trim() || null,
      ticketingRoles,
      hideTicketingDate: hide_ticketing_date,
      referralsEnabled: referrals_enabled,
      standbyEnabled: standby_enabled,
      identityVerificationEnabled: identity_verification_enabled,
      allowAdmittingStandby: allow_admitting_standby,
      livestream: livestream || null,
      latitude: latitude || "0",
      longitude: longitude || "0",
      address: address || "",
      externalTicketingEnabled: external_ticketing_enabled,
      externalTicketingUrl: external_ticketing_enabled
        ? external_ticketing_url
        : null,
      bannerEligible: banner_eligible,
    };

    // Enforce: ticketing date must be on/after release date when both are set
    if (releaseDateValue && ticketingDateValue) {
      const publishMs = releaseDateValue.getTime();
      const ticketingMs = ticketingDateValue.getTime();
      if (Number.isNaN(publishMs) || Number.isNaN(ticketingMs)) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 },
        );
      }
      if (ticketingMs < publishMs) {
        return NextResponse.json(
          {
            error: "Ticketing date must be on or after the release date.",
          },
          { status: 400 },
        );
      }
    }

    if (startTimeDateValue && endTimeDateValue) {
      const startMs = startTimeDateValue.getTime();
      const endMs = endTimeDateValue.getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 },
        );
      }
      if (endMs < startMs) {
        return NextResponse.json(
          {
            error: "End time must be on or after the event start time.",
          },
          { status: 400 },
        );
      }
    }

    if (imgName) {
      eventData.img = imgName;
    }

    if (mobileImgName) {
      eventData.mobileImg = mobileImgName;
    }

    if (appleWalletImgName) {
      eventData.appleWalletImg = appleWalletImgName;
    }

    if (imgName || mobileImgName) {
      eventData.imgVersion =
        id && existingEvent ? existingEvent.imgVersion + 1 : 1;
    }

    let savedEvent: InferSelectModel<typeof events> | undefined;

    if (id) {
      // Update existing event
      const [updated] = await db
        .update(events)
        .set(eventData)
        .where(eq(events.id, id))
        .returning();
      savedEvent = updated;
    } else {
      // Create new event
      const [created] = await db.insert(events).values(eventData).returning();
      savedEvent = created;
    }

    if (!savedEvent) {
      return NextResponse.json(
        { error: "Failed to save event" },
        { status: 500 },
      );
    }

    if (id && existingEvent && savedEvent) {
      const previousCapacity = existingEvent.capacity;
      const previousReserved = existingEvent.reserved;
      const newCapacity = savedEvent.capacity;
      const newReserved = savedEvent.reserved;

      const capacityIncreased = newCapacity > previousCapacity;
      const reservedDecreased = newReserved < previousReserved;

      if (capacityIncreased || reservedDecreased) {
        try {
          const trigger =
            capacityIncreased && reservedDecreased
              ? "event.capacity_increase_and_reserved_decrease"
              : capacityIncreased
                ? "event.capacity_increase"
                : "event.reserved_decrease";

          await pullFromWaitlist(adminClient, savedEvent.id, undefined, {
            actor: auth.email!,
            metadata: {
              trigger,
              previousCapacity,
              newCapacity,
              previousReserved,
              newReserved,
            },
          });
        } catch (waitlistError) {
          console.error(
            "Waitlist conversion error (non-fatal):",
            waitlistError,
          );
        }
      }
    }

    // If a wallet-visible event field changed, refresh every installed pass for
    // this event (the pass is rebuilt live from the event row, so we only need
    // to bump the timestamp + push — no event data is duplicated onto tickets).
    if (id && existingEvent && savedEvent) {
      const norm = (v: unknown) =>
        v instanceof Date ? v.getTime() : v == null ? null : String(v);
      const walletFields: (keyof InferSelectModel<typeof events>)[] = [
        "name",
        "doorsOpen",
        "startTimeDate",
        "venue",
        "venueLink",
        "latitude",
        "longitude",
        "address",
        "route",
        "appleWalletImg",
        "img",
        "imgVersion",
      ];
      const walletFieldChanged = walletFields.some(
        (f) => norm(existingEvent![f]) !== norm(savedEvent![f]),
      );
      if (walletFieldChanged) {
        try {
          const eventTickets = await db.query.tickets.findMany({
            where: eq(ticketsTable.eventId, savedEvent.id),
            columns: { id: true },
          });
          await pushWalletUpdate(eventTickets.map((t) => t.id), {
            actor: auth.email ?? undefined,
            reason: "event.edit",
            eventId: savedEvent.id,
            eventName: savedEvent.name ?? null,
          });
        } catch (pushError) {
          console.error(
            "Wallet event-change push failed (non-fatal):",
            pushError,
          );
        }
      }
    }

    const auditMetadata: Record<string, unknown> = {};
    if (id && existingEvent) {
      const changes = diffEventSnapshots(
        buildEventSnapshot(existingEvent),
        buildEventSnapshot(savedEvent),
      );
      auditMetadata.changedFields = Object.keys(changes);
      auditMetadata.changes = changes;
    } else {
      auditMetadata.initial = buildEventSnapshot(savedEvent);
    }

    await logAuditEvent({
      action: id ? "event.edit" : "event.create",
      actor: auth.email!,
      eventId: savedEvent.id,
      eventName: savedEvent.name ?? null,
      metadata: auditMetadata,
    });

    const eventWithImage = await serializeEventWithImages(savedEvent);

    return NextResponse.json({ success: true, event: eventWithImage });
  } catch (error) {
    console.error("Event save error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, live, standbyEnabled, identityVerificationEnabled, allowAdmittingStandby } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("events.edit", id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (typeof standbyEnabled === "boolean") {
      const [updatedEvent] = await db
        .update(events)
        .set({ standbyEnabled })
        .where(eq(events.id, id))
        .returning();

      await logAuditEvent({
        action: "event.toggle_standby",
        actor: auth.email!,
        eventId: id,
        eventName: updatedEvent.name ?? null,
        metadata: { standbyEnabled },
      });

      const eventWithImage = await serializeEventWithImages(updatedEvent);

      return NextResponse.json({ success: true, event: eventWithImage });
    }

    if (typeof identityVerificationEnabled === "boolean") {
      const [updatedEvent] = await db
        .update(events)
        .set({ identityVerificationEnabled })
        .where(eq(events.id, id))
        .returning();

      await logAuditEvent({
        action: "event.toggle_identity_verification",
        actor: auth.email!,
        eventId: id,
        eventName: updatedEvent.name ?? null,
        metadata: { identityVerificationEnabled },
      });

      const eventWithImage = await serializeEventWithImages(updatedEvent);

      return NextResponse.json({ success: true, event: eventWithImage });
    }

    if (typeof allowAdmittingStandby === "boolean") {
      const previous = await db.query.events.findFirst({
        where: eq(events.id, id),
        columns: { allowAdmittingStandby: true },
      });

      const [updatedEvent] = await db
        .update(events)
        .set({ allowAdmittingStandby })
        .where(eq(events.id, id))
        .returning();

      await logAuditEvent({
        action: "event.toggle_allow_admitting_standby",
        actor: auth.email!,
        eventId: id,
        eventName: updatedEvent.name ?? null,
        metadata: { allowAdmittingStandby },
      });

      // Standby passes render their status live from this flag, so refresh the
      // installed passes of this event's standby tickets when it actually flips
      // (either direction — "please wait" ↔ "entry permitted").
      if ((previous?.allowAdmittingStandby ?? false) !== allowAdmittingStandby) {
        try {
          const standbyTickets = await db.query.tickets.findMany({
            where: and(
              eq(ticketsTable.eventId, id),
              eq(ticketsTable.type, "STANDBY"),
            ),
            columns: { id: true },
          });
          await pushWalletUpdate(standbyTickets.map((t) => t.id), {
            actor: auth.email ?? undefined,
            reason: "event.toggle_allow_admitting_standby",
            eventId: id,
            eventName: updatedEvent.name ?? null,
          });
        } catch (pushError) {
          console.error(
            "Wallet standby-admit push failed (non-fatal):",
            pushError,
          );
        }
      }

      const eventWithImage = await serializeEventWithImages(updatedEvent);

      return NextResponse.json({ success: true, event: eventWithImage });
    }

    if (typeof live !== "boolean") {
      return NextResponse.json(
        { error: "A boolean field (live, standbyEnabled, identityVerificationEnabled, or allowAdmittingStandby) is required" },
        { status: 400 },
      );
    }

    if (live) {
      // Set all events to not live first
      await db.update(events).set({ live: false }).where(ne(events.id, id));

      // Set the specified event to live
      const [updatedEvent] = await db
        .update(events)
        .set({ live: true })
        .where(eq(events.id, id))
        .returning();

      await logAuditEvent({
        action: "event.toggle_live",
        actor: auth.email!,
        eventId: id,
        eventName: updatedEvent.name ?? null,
        metadata: { live: true },
      });

      const eventWithImage = await serializeEventWithImages(updatedEvent);

      return NextResponse.json({ success: true, event: eventWithImage });
    } else {
      // Just set this event to not live
      const [updatedEvent] = await db
        .update(events)
        .set({ live: false })
        .where(eq(events.id, id))
        .returning();

      await logAuditEvent({
        action: "event.toggle_live",
        actor: auth.email!,
        eventId: id,
        eventName: updatedEvent.name ?? null,
        metadata: { live: false },
      });

      const eventWithImage = await serializeEventWithImages(updatedEvent);

      return NextResponse.json({ success: true, event: eventWithImage });
    }
  } catch (error) {
    console.error("Event live update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("events.edit", id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, id),
      columns: { name: true, img: true, mobileImg: true, appleWalletImg: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const activeTicket = await db.query.tickets.findFirst({
      where: eq(ticketsTable.eventId, id),
      columns: { id: true },
    });

    if (activeTicket) {
      return NextResponse.json(
        { error: "Cannot delete an event with active tickets." },
        { status: 409 },
      );
    }

    // Delete storage images only after confirming deletion is allowed.
    const imagesToDelete = [
      event.img,
      event.mobileImg,
      event.appleWalletImg,
    ].filter((value): value is string => !!value);
    if (imagesToDelete.length > 0) {
      const adminClient = auth.adminClient!;
      await adminClient.storage.from("speakers").remove(imagesToDelete);
    }

    // Delete the event
    await db.delete(events).where(eq(events.id, id));

    await logAuditEvent({
      action: "event.delete",
      actor: auth.email!,
      eventId: id,
      eventName: event?.name ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
