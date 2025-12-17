import { NextResponse } from "next/server";
import { getSignedImageUrl, verifyAdminRequest } from "@/app/lib/supabase";
import { randomUUID } from "crypto";
import { fromZonedTime } from "date-fns-tz";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import {
  isValidUUID,
  isValidUrl,
  isValidRoute,
  isValidCapacity,
  isValidImageExtension,
  isValidImageSize,
  isValidDateString,
} from "@/app/lib/validation";

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

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
    const start_time_date = formData.get("start_time_date") as string;
    const doors_open = formData.get("doors_open") as string;
    const route = formData.get("route") as string;
    const banner = formData.get("banner") === "true";
    const imageFile = formData.get("image") as File | null;

    // Validate ID if provided
    if (id && !isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    // Validate capacity
    if (capacity && !isValidCapacity(capacity)) {
      return NextResponse.json(
        { error: "Invalid capacity value" },
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
    if (start_time_date && !isValidDateString(start_time_date)) {
      return NextResponse.json(
        { error: "Invalid start time date format" },
        { status: 400 },
      );
    }
    if (doors_open && !isValidDateString(doors_open)) {
      return NextResponse.json(
        { error: "Invalid doors open date format" },
        { status: 400 },
      );
    }

    let imgName: string | null = null;

    // Handle image upload with validation
    if (imageFile && imageFile.size > 0) {
      // Validate file size
      if (!isValidImageSize(imageFile.size)) {
        return NextResponse.json(
          { error: "Image file too large. Maximum size is 5MB." },
          { status: 400 },
        );
      }

      // Validate file extension
      if (!isValidImageExtension(imageFile.name)) {
        return NextResponse.json(
          {
            error:
              "Invalid image file type. Allowed types: JPG, PNG, GIF, WebP.",
          },
          { status: 400 },
        );
      }

      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${randomUUID()}.${fileExt}`;

      const { error: uploadError } = await auth
        .adminClient!.storage.from("speakers")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Image upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 },
        );
      }

      imgName = fileName;
    }

    const eventData: Record<string, unknown> = {
      name: name || null,
      desc: desc || null,
      tagline: tagline || null,
      capacity: capacity ? parseInt(capacity) : 0,
      // tickets = tickets sold so far (new field)
      tickets: tickets
        ? parseInt(tickets)
        : reserved
          ? parseInt(reserved)
          : null,
      // reserved is legacy (kept for backwards compatibility / older rows)
      reserved: reserved ? parseInt(reserved) : null,
      venue: venue || null,
      venue_link: venue_link || null,
      release_date: release_date
        ? fromZonedTime(release_date, PACIFIC_TIMEZONE).toISOString()
        : null,
      start_time_date: start_time_date
        ? fromZonedTime(start_time_date, PACIFIC_TIMEZONE).toISOString()
        : null,
      doors_open: doors_open
        ? fromZonedTime(doors_open, PACIFIC_TIMEZONE).toISOString()
        : null,
      route: route || null,
      banner: banner,
    };

    if (imgName) {
      eventData.img = imgName;
    }

    let savedEvent: any;

    if (id) {
      // Update existing event
      const { data, error } = await auth
        .adminClient!.from("events")
        .update(eventData)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("Event update error:", error);
        return NextResponse.json(
          { error: "Failed to update event" },
          { status: 500 },
        );
      }

      savedEvent = data;
    } else {
      // Create new event
      const { data, error } = await auth
        .adminClient!.from("events")
        .insert([eventData])
        .select("*")
        .single();

      if (error) {
        console.error("Event insert error:", error);
        return NextResponse.json(
          { error: "Failed to create event" },
          { status: 500 },
        );
      }

      savedEvent = data;
    }

    const eventWithImage = savedEvent
      ? {
          ...savedEvent,
          image_url: savedEvent.img
            ? await getSignedImageUrl(savedEvent.img, 60 * 60)
            : null,
        }
      : null;

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
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, live } = body;

    if (!id || typeof live !== "boolean") {
      return NextResponse.json(
        { error: "Event ID and live status are required" },
        { status: 400 },
      );
    }

    const adminClient = auth.adminClient!;

    if (live) {
      // Set all events to not live first
      await adminClient.from("events").update({ live: false }).neq("id", id);

      // Set the specified event to live
      const { data, error } = await adminClient
        .from("events")
        .update({ live: true })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("Event live update error:", error);
        return NextResponse.json(
          { error: "Failed to update live status" },
          { status: 500 },
        );
      }

      const eventWithImage = data
        ? {
            ...data,
            image_url: data.img
              ? await getSignedImageUrl(data.img, 60 * 60)
              : null,
          }
        : null;

      return NextResponse.json({ success: true, event: eventWithImage });
    } else {
      // Just set this event to not live
      const { data, error } = await adminClient
        .from("events")
        .update({ live: false })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("Event live update error:", error);
        return NextResponse.json(
          { error: "Failed to update live status" },
          { status: 500 },
        );
      }

      const eventWithImage = data
        ? {
            ...data,
            image_url: data.img
              ? await getSignedImageUrl(data.img, 60 * 60)
              : null,
          }
        : null;

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
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

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

    // Get the event first to delete its image
    const { data: event } = await auth
      .adminClient!.from("events")
      .select("img")
      .eq("id", id)
      .single();

    // Delete the image from storage if it exists
    if (event?.img) {
      await auth.adminClient!.storage.from("speakers").remove([event.img]);
    }

    // Delete the event
    const { error } = await auth
      .adminClient!.from("events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Event delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete event" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
