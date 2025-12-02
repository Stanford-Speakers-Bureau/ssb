import { NextResponse } from "next/server";
import { getSignedImageUrl, verifyAdminRequest } from "../../../lib/supabase";

export async function GET() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { data: events, error } = await auth.adminClient!
      .from("events")
      .select("*")
      .order("start_time_date", { ascending: false });

    if (error) {
      console.error("Events fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    const eventsWithImages =
      events
        ? await Promise.all(
            events.map(async (event) => ({
              ...event,
              image_url: event.img
                ? await getSignedImageUrl(event.img, 60 * 60) // 1 hour expiry
                : null,
            }))
          )
        : [];

    return NextResponse.json({ events: eventsWithImages });
  } catch (error) {
    console.error("Events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const capacity = formData.get("capacity") as string;
    const venue = formData.get("venue") as string;
    const venue_link = formData.get("venue_link") as string;
    const release_date = formData.get("release_date") as string;
    const start_time_date = formData.get("start_time_date") as string;
    const doors_open = formData.get("doors_open") as string;
    const route = formData.get("route") as string;
    const banner = formData.get("banner") === "true";
    const imageFile = formData.get("image") as File | null;

    let imgName: string | null = null;

    // Handle image upload
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await auth.adminClient!.storage
        .from("speakers")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Image upload error:", uploadError);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
      }

      imgName = fileName;
    }

    const eventData: Record<string, unknown> = {
      name: name || null,
      desc: desc || null,
      capacity: capacity ? parseInt(capacity) : 0,
      venue: venue || null,
      venue_link: venue_link || null,
      release_date: release_date ? new Date(release_date).toISOString() : null,
      start_time_date: start_time_date ? new Date(start_time_date).toISOString() : null,
      doors_open: doors_open ? new Date(doors_open).toISOString() : null,
      route: route || null,
      banner: banner,
    };

    if (imgName) {
      eventData.img = imgName;
    }

    if (id) {
      // Update existing event
      const { error } = await auth.adminClient!
        .from("events")
        .update(eventData)
        .eq("id", id);

      if (error) {
        console.error("Event update error:", error);
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
      }
    } else {
      // Create new event
      const { error } = await auth.adminClient!
        .from("events")
        .insert([eventData]);

      if (error) {
        console.error("Event insert error:", error);
        return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event save error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    // Get the event first to delete its image
    const { data: event } = await auth.adminClient!
      .from("events")
      .select("img")
      .eq("id", id)
      .single();

    // Delete the image from storage if it exists
    if (event?.img) {
      await auth.adminClient!.storage
        .from("speakers")
        .remove([event.img]);
    }

    // Delete the event
    const { error } = await auth.adminClient!
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Event delete error:", error);
      return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

