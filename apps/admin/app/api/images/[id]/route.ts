import { NextRequest, NextResponse } from "next/server";
import { db, eq, events } from "@ssb/db";
import { requireActionAnyScope } from "@/app/lib/permissions";
import { getSignedImageUrl } from "@/app/lib/supabase";
import { isValidUUID } from "@/app/lib/validation";

type Params = { params: Promise<{ id: string }> };

/**
 * Campaign-editor image preview. The web app serves event images at its own
 * `/api/images/{eventId}`, but that depends on web being reachable and, for
 * unreleased events, a signed token the browser can't mint. The live preview
 * just needs to render the hero image, so this admin route signs the image
 * straight from Supabase storage (the same bucket web reads) and redirects to
 * it. Gated on `campaigns.send` so it grants no more visibility than the
 * campaign editor already does.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const auth = await requireActionAnyScope("campaigns.send");
  if (!auth.authorized) {
    return new NextResponse(auth.error ?? "Not authorized", { status: 401 });
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
    columns: { img: true, mobileImg: true },
  });
  if (!event) {
    return new NextResponse("Not found", { status: 404 });
  }

  const wantsMobile =
    new URL(request.url).searchParams.get("variant") === "mobile";
  const imgName = wantsMobile
    ? event.mobileImg || event.img
    : event.img || event.mobileImg;

  const signedUrl = await getSignedImageUrl(imgName);
  if (!signedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(signedUrl);
}
